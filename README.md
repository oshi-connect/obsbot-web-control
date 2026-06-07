# OBSBot Web Control

A tiny remote PTZ web widget for the **OBSBot Tiny SE**, designed to pair with [VDO.Ninja](https://vdo.ninja/) so a remote operator (or the talent themselves) can pan, tilt, zoom, and recall presets from any phone or laptop browser.

The server runs on the host machine the camera is plugged into, talks to the camera over the official OBSBot SDK (USB), and exposes a minimal mobile-first UI plus a small WebSocket protocol.

## Features

- Live pan/tilt control with hold-to-move buttons (auto-stop on release, blur, or visibility change)
- Zoom level + range reporting
- Saved-preset recall
- Reset gimbal to center
- Auto-reconnect WebSocket client
- Optional shared-token auth (`AUTH_TOKEN`)
- Mobile-first UI tuned for VDO.Ninja overlay use

## Requirements

- **Hardware**: OBSBot Tiny SE (other Tiny-family devices may work but are untested)
- **OS**: macOS or Linux (the native SDK addon builds for both; Windows is unsupported by the setup script today)
- **Node**: `>=22.18.0`
- **pnpm**: `>=9`
- A C/C++ toolchain + Python 3 to build the native addon (`node-gyp`)

If you use Nix, the bundled `flake.nix` provides a dev shell with all of this:

```bash
nix develop
```

## Install

```bash
pnpm install
```

The `postinstall` step (`scripts/setup-obsbot-sdk.mjs`) will:

1. Symlink `node-addon-api` into the `obsbot-sdk` package.
2. Apply local patches from `patches/` (e.g. exposing `getGimbalPose`).
3. Run `node-gyp rebuild` to build the native addon.
4. On macOS, fix up the rpath so `libdev.dylib` loads via `@loader_path`.

## Run

```bash
pnpm dev      # tsx watch (auto-reload)
pnpm start    # one-shot
```

Then open `http://<host>:3000`.

### Environment variables

| Variable          | Default   | Description                                                  |
| ----------------- | --------- | ------------------------------------------------------------ |
| `PORT`            | `3000`    | HTTP/WS port                                                 |
| `HOST`            | `0.0.0.0` | Bind address                                                 |
| `AUTH_TOKEN`      | _(none)_  | If set, clients must send `{type:"auth", payload:{token}}`   |
| `GIMBAL_LOG`      | `0`       | Set to `1` to log gimbal pose to stdout                      |
| `GIMBAL_POLL_HZ`  | `30`      | Poll rate for `GIMBAL_LOG`                                   |

## Pairing with VDO.Ninja

The widget is sized for a 320 px column and renders cleanly inside a VDO.Ninja overlay or PiP frame. Typical setup:

1. Run this server on the machine the OBSBot is plugged into.
2. Expose it (LAN, Tailscale, Cloudflare Tunnel, etc.) and set `AUTH_TOKEN`.
3. Drop the URL (with the token saved in localStorage on first connect) into a VDO.Ninja `&overlay=` iframe or open it directly on a phone.

## WebSocket protocol

All messages are JSON: `{ "type": string, "payload"?: any }`.

### Client → server

| Type           | Payload                          | Notes                                  |
| -------------- | -------------------------------- | -------------------------------------- |
| `auth`         | `{ token: string }`              | Required if `AUTH_TOKEN` is set        |
| `status`       | _(none)_                         | Request a status snapshot              |
| `ptz:move`     | `{ pitch: number, pan: number }` | Velocities; throttled to 80 ms         |
| `ptz:stop`     | _(none)_                         | Sets velocities to 0                   |
| `ptz:reset`    | _(none)_                         | Recenter gimbal                        |
| `zoom:set`     | `{ level: number }`              | Clamped to camera range                |
| `preset:list`  | _(none)_                         | Request preset list                    |
| `preset:goto`  | `{ id: number }`                 | Recall a saved preset                  |

### Server → client

| Type             | Payload                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------- |
| `auth:required`  | _(none)_                                                                                 |
| `auth:ok`        | _(none)_                                                                                 |
| `status`         | `{ connected, deviceName, productType, zoom, zoomRange, presets, gimbal }`               |
| `preset:list`    | `Preset[]`                                                                               |
| `error`          | `{ message: string }`                                                                    |

Status is broadcast every 5 seconds and on device attach/detach events.

## Project layout

```
src/server.ts           Express + ws server, OBSBot SDK glue
public/index.html       Self-contained mobile UI
scripts/setup-obsbot-sdk.mjs  Native addon build + patch step
patches/                Local patches against obsbot-js-sdk
src/obsbot-sdk.d.ts     Hand-written typings for obsbot-js-sdk
```

## Acknowledgments

- [`malko/obsbot-js-sdk`](https://github.com/malko/obsbot-js-sdk) — Node bindings for the OBSBot SDK
- OBSBot for the SDK itself

## License

[MIT](./LICENSE) © Oshi Connect
