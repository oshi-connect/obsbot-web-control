#!/usr/bin/env node
import { existsSync, mkdirSync, rmSync, symlinkSync, lstatSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const sdkDir = resolve(root, "node_modules", "obsbot-sdk")
const napiSrc = resolve(root, "node_modules", "node-addon-api")
const sdkNapiDir = resolve(sdkDir, "node_modules", "node-addon-api")
const buildOut = resolve(sdkDir, "build", "Release", "obsbot_native.node")

const log = (msg) => console.log(`[setup-obsbot-sdk] ${msg}`)

if (!existsSync(sdkDir)) {
  log("obsbot-sdk not installed — nothing to do")
  process.exit(0)
}

if (!existsSync(napiSrc)) {
  console.error("[setup-obsbot-sdk] node-addon-api missing at node_modules/node-addon-api")
  console.error("                   ensure it is in devDependencies of the root package.json")
  process.exit(1)
}

mkdirSync(dirname(sdkNapiDir), { recursive: true })

if (existsSync(sdkNapiDir) || lstatExists(sdkNapiDir)) {
  rmSync(sdkNapiDir, { recursive: true, force: true })
}
symlinkSync(napiSrc, sdkNapiDir, "dir")
log(`linked node-addon-api into obsbot-sdk/node_modules`)

if (existsSync(buildOut)) {
  log("native addon already built")
  process.exit(0)
}

const nodeGyp = resolve(root, "node_modules", ".bin", process.platform === "win32" ? "node-gyp.cmd" : "node-gyp")
if (!existsSync(nodeGyp)) {
  console.error(`[setup-obsbot-sdk] node-gyp binary missing at ${nodeGyp}`)
  process.exit(1)
}

log("building native addon (node-gyp rebuild)...")
const result = spawnSync(nodeGyp, ["rebuild"], {
  cwd: sdkDir,
  stdio: "inherit",
  env: { ...process.env, npm_config_python: process.env.npm_config_python ?? "" },
})

if (result.status !== 0) {
  console.error("[setup-obsbot-sdk] build failed")
  process.exit(result.status ?? 1)
}

if (process.platform === "darwin" && existsSync(buildOut)) {
  const otool = spawnSync("otool", ["-l", buildOut], { encoding: "utf8" })
  const hasLoaderPath = otool.stdout?.includes("@loader_path")
  if (!hasLoaderPath) {
    log("patching macOS rpath (@loader_path) for libdev.dylib")
    const fix = spawnSync("install_name_tool", ["-add_rpath", "@loader_path", buildOut], { stdio: "inherit" })
    if (fix.status !== 0) {
      console.error("[setup-obsbot-sdk] install_name_tool failed -- libdev.dylib may not load")
      process.exit(fix.status ?? 1)
    }
  }
}

log("build complete")

function lstatExists(p) {
  try { lstatSync(p); return true } catch { return false }
}
