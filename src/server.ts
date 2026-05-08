import http from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"
import express from "express"
import { WebSocketServer, WebSocket } from "ws"
import { osbotSdk } from "obsbot-sdk"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = path.resolve(__dirname, "..", "public")
const PORT = Number(process.env.PORT ?? 3000)
const HOST = process.env.HOST ?? "0.0.0.0"
const AUTH_TOKEN = process.env.AUTH_TOKEN ?? ""

type TinyDeviceLike = InstanceType<typeof osbotSdk.TinyDevice>
type Preset = { id: number; pitch: number; pan: number; zoom: number }
type ZoomMeta = { min: number; max: number; step: number; default: number }
type StatusSnapshot = {
  connected: boolean
  deviceName: string | null
  productType: string | null
  zoom: number | null
  zoomRange: { min: number; max: number; step: number } | null
  presets: Preset[]
  gimbal: { pitch: number; pan: number; roll: number } | null
}

let activeDevice: TinyDeviceLike | null = null
let zoomMeta: ZoomMeta | null = null

const safe = <T,>(fn: () => T, fallback: T): T => {
  try { return fn() } catch { return fallback }
}

const isTinyDevice = (d: unknown): d is TinyDeviceLike =>
  d instanceof osbotSdk.TinyDevice

const pickTinyDevice = (): TinyDeviceLike | null => {
  const list = safe(() => osbotSdk.getDevList(), [] as unknown[])
  return (list.find(isTinyDevice) as TinyDeviceLike | undefined) ?? null
}

const detectZoomMeta = (d: TinyDeviceLike): ZoomMeta | null => {
  const range = safe(() => d.getZoomRange(), null as { min: number; max: number } | null)
  if (!range) return null
  return { min: range.min, max: range.max, step: 1, default: range.min }
}

const refreshActiveDevice = () => {
  activeDevice = pickTinyDevice()
  zoomMeta = activeDevice ? detectZoomMeta(activeDevice) : null
  if (activeDevice) {
    console.log(`[obsbot] active device: ${activeDevice.getName()} (${activeDevice.getSn()})`)
  } else {
    console.log("[obsbot] no compatible device")
  }
}

const getStatusSnapshot = (): StatusSnapshot => {
  const d = activeDevice
  if (!d) {
    return {
      connected: false,
      deviceName: null,
      productType: null,
      zoom: null,
      zoomRange: null,
      presets: [],
      gimbal: null,
    }
  }
  const status = safe(() => d.getStatus?.(), undefined)
  const zoom = safe(() => d.getZoom(), null as number | null)
  const zoomRange = zoomMeta ? { min: zoomMeta.min, max: zoomMeta.max, step: zoomMeta.step } : null
  const presets = safe(() => d.getPresetList?.() ?? [], [] as Preset[])
  return {
    connected: true,
    deviceName: safe(() => d.getName(), "OBSBot"),
    productType: safe(() => d.getProductTypeName?.() ?? null, null),
    zoom,
    zoomRange,
    presets,
    gimbal: status?.gimbal
      ? { pitch: status.gimbal.pitch, pan: status.gimbal.pan, roll: status.gimbal.roll }
      : null,
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

type ClientState = {
  ws: WebSocket
  authed: boolean
  lastMoveAt: number
}

const MOVE_MIN_INTERVAL_MS = 80

const send = (ws: WebSocket, type: string, payload: unknown = null) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload }))
  }
}

const broadcastStatus = (wss: WebSocketServer) => {
  const snapshot = getStatusSnapshot()
  const msg = JSON.stringify({ type: "status", payload: snapshot })
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg)
  }
}

const handleMessage = (state: ClientState, raw: string) => {
  let msg: { type: string; payload?: Record<string, unknown> }
  try {
    msg = JSON.parse(raw)
  } catch {
    send(state.ws, "error", { message: "invalid json" })
    return
  }

  if (AUTH_TOKEN && !state.authed) {
    if (msg.type === "auth" && msg.payload?.token === AUTH_TOKEN) {
      state.authed = true
      send(state.ws, "auth:ok")
      send(state.ws, "status", getStatusSnapshot())
      return
    }
    send(state.ws, "error", { message: "auth required" })
    return
  }

  const d = activeDevice
  if (!d && msg.type !== "status") {
    send(state.ws, "error", { message: "no device connected" })
    return
  }

  switch (msg.type) {
    case "ptz:move": {
      const now = Date.now()
      if (now - state.lastMoveAt < MOVE_MIN_INTERVAL_MS) return
      state.lastMoveAt = now
      const rawPitch = Number(msg.payload?.pitch ?? 0)
      const rawPan = Number(msg.payload?.pan ?? 0)
      const pitch = clamp(rawPitch, -90, 90)
      const pan = clamp(rawPan, -180, 180)
      safe(() => d!.gimbalMove(pitch, pan), false)
      return
    }
    case "ptz:stop": {
      safe(() => d!.gimbalMove(0, 0), false)
      return
    }
    case "ptz:reset": {
      safe(() => d!.gimbalReset(), false)
      return
    }
    case "zoom:set": {
      if (!zoomMeta) zoomMeta = detectZoomMeta(d!)
      if (!zoomMeta) return
      const level = clamp(Number(msg.payload?.level ?? zoomMeta.min), zoomMeta.min, zoomMeta.max)
      safe(() => d!.setZoom(level), false)
      send(state.ws, "status", getStatusSnapshot())
      return
    }
    case "preset:list": {
      const presets = safe(() => d!.getPresetList?.() ?? [], [] as Preset[])
      send(state.ws, "preset:list", presets)
      return
    }
    case "preset:goto": {
      const id = Number(msg.payload?.id ?? -1)
      if (!Number.isInteger(id) || id < 0) {
        send(state.ws, "error", { message: "invalid preset id" })
        return
      }
      safe(() => d!.goToPreset?.(id), false)
      return
    }
    case "status": {
      send(state.ws, "status", getStatusSnapshot())
      return
    }
    default:
      send(state.ws, "error", { message: `unknown message type: ${msg.type}` })
  }
}

const initSdk = () => {
  const ok = osbotSdk.init()
  if (ok !== 0) {
    console.error(`[obsbot] init failed (code ${ok})`)
    process.exit(1)
  }
  console.log("[obsbot] SDK initialized")
  refreshActiveDevice()
}

const main = () => {
  initSdk()

  const app = express()
  app.use(express.static(PUBLIC_DIR, { maxAge: 0, etag: false }))
  app.get("/healthz", (_req, res) => {
    res.json({ ok: true, hasDevice: activeDevice !== null })
  })

  const server = http.createServer(app)
  const wss = new WebSocketServer({ server, path: "/ws" })

  osbotSdk.setDevChangedCallback((sn: string, attached: boolean) => {
    console.log(`[obsbot] ${attached ? "attached" : "detached"}: ${sn}`)
    refreshActiveDevice()
    broadcastStatus(wss)
  })

  wss.on("connection", (ws) => {
    const state: ClientState = { ws, authed: !AUTH_TOKEN, lastMoveAt: 0 }
    if (state.authed) {
      send(ws, "status", getStatusSnapshot())
    } else {
      send(ws, "auth:required")
    }
    ws.on("message", (raw) => handleMessage(state, raw.toString()))
    ws.on("close", () => {
      safe(() => activeDevice?.gimbalMove(0, 0), false)
    })
  })

  const statusTimer = setInterval(() => broadcastStatus(wss), 5000)

  server.listen(PORT, HOST, () => {
    console.log(`[server] listening on http://${HOST}:${PORT}`)
    if (AUTH_TOKEN) console.log("[server] auth token required")
  })

  const shutdown = () => {
    console.log("\n[server] shutting down...")
    clearInterval(statusTimer)
    safe(() => activeDevice?.gimbalMove(0, 0), false)
    safe(() => osbotSdk.release(), undefined)
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 2000)
  }
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

main()
