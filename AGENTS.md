# AGENTS.md

Guidance for coding agents working in this repository. Keep it accurate: every
command and fact below comes from files in this repo. Do not add scripts, ports,
or behavior that are not grounded here.

## What this is

`obsbot-web-control` — a small remote PTZ web widget for the OBSBot Tiny SE
camera, meant to pair with VDO.Ninja. A server runs on the host the camera is
plugged into, talks to the camera over the OBSBot SDK via USB, and serves a
mobile-first web UI plus a WebSocket control protocol.

- Package: `obsbot-web-control`, version `0.1.0`, `private`, MIT, `"type": "module"`.
- Single-package repo (no workspaces/monorepo). Source is TypeScript run directly with `tsx`.

## Stack and constraints

- Runtime: Node `>=22.18.0` (`engines` in `package.json`).
- Package manager: pnpm `>=9`, pinned `packageManager: pnpm@9.15.4`. Use pnpm, not npm or yarn.
- `.npmrc` sets `node-linker=hoisted`.
- Dependencies: `express`, `ws`, `tsx`, and `obsbot-sdk` (installed from GitHub: `github:malko/obsbot-js-sdk`).
- Dev dependencies include `typescript`, `node-gyp`, `node-addon-api`, and the `@types/*` packages.
- `obsbot-sdk` is listed under `pnpm.neverBuiltDependencies`; its native addon is
  instead built by the `postinstall` script (see below), which needs a C/C++
  toolchain and Python 3.
- Platform: the setup script supports macOS and Linux. It has a `win32` branch for
  locating `node-gyp` but otherwise targets macOS/Linux (macOS-specific rpath fix via
  `install_name_tool`). Treat Windows as unsupported.
- Hardware: real control needs an OBSBot Tiny SE on USB. Without a device, the SDK
  still initializes but reports no compatible device; most control messages respond
  with `{"type":"error"}`.

## Layout

```
src/server.ts                 Express + ws server and OBSBot SDK glue (entry point)
src/obsbot-sdk.d.ts           Hand-written typings for the obsbot-sdk module
public/index.html             Self-contained mobile UI (static, served by Express)
scripts/setup-obsbot-sdk.mjs  postinstall: native addon build + link step
tsconfig.json                 Base TS config (noEmit, strict, ESNext/Bundler)
tsconfig.check.json           Typecheck config; maps obsbot-sdk -> src/obsbot-sdk.d.ts
flake.nix / flake.lock        Nix dev shell (node 22, pnpm, python3, toolchain)
.envrc                        direnv: `use flake`
BRAND_GUIDE.md                Oshi Connect brand tokens (reference only)
```

Note: `README.md` references a `patches/` directory, but it does not exist in the
repo and `scripts/setup-obsbot-sdk.mjs` does not apply patches. Do not assume one
is present.

## Install

```bash
pnpm install
```

This runs the `postinstall` script `scripts/setup-obsbot-sdk.mjs`, which:

1. Symlinks the root `node-addon-api` into `node_modules/obsbot-sdk/node_modules`.
2. Skips rebuilding if `build/Release/obsbot_native.node` already exists.
3. Otherwise runs `node-gyp rebuild` in the `obsbot-sdk` package.
4. On macOS, adds `@loader_path` to the addon's rpath via `install_name_tool`.

A build failure here fails the install. The step needs `node-gyp`, a compiler, and
Python 3 available (`npm_config_python` is passed through).

With Nix, a dev shell with Node 22, pnpm, Python 3, and a toolchain is provided:

```bash
nix develop
```

## Run

```bash
pnpm dev      # tsx watch src/server.ts (auto-reload)
pnpm start    # tsx src/server.ts (one-shot)
```

The server listens on `http://<HOST>:<PORT>` (defaults `0.0.0.0:3000`) and serves
`public/` statically. Endpoints: `GET /healthz` returns `{ ok, hasDevice }`;
WebSocket is at path `/ws`.

### Environment variables (read in `src/server.ts`)

| Variable         | Default   | Purpose                                                      |
| ---------------- | --------- | ----------------------------------------------------------- |
| `PORT`           | `3000`    | HTTP/WS port                                                |
| `HOST`           | `0.0.0.0` | Bind address                                                |
| `AUTH_TOKEN`     | _(none)_  | If set, clients must authenticate before control messages   |
| `GIMBAL_LOG`     | _(unset)_ | Set to `1` to log gimbal pose to stdout                     |
| `GIMBAL_POLL_HZ` | `30`      | Poll rate used when `GIMBAL_LOG=1`                          |

## Checks

- Typecheck: `pnpm typecheck` (`tsc --noEmit -p tsconfig.check.json`).

There are no `test`, `lint`, or `build` scripts in `package.json`, and no test,
lint, or bundler config in the repo. Do not invent or assume them. The only
available programmatic check is the typecheck above. Typecheck uses
`tsconfig.check.json`, which maps the `obsbot-sdk` import to the local
`src/obsbot-sdk.d.ts` typings, so typechecking does not require the SDK to be built.

## What not to break

- Keep `pnpm` and the pinned Node/pnpm versions; do not switch package managers or add a `package-lock.json`.
- Keep `obsbot-sdk` in `pnpm.neverBuiltDependencies`; the native addon is built by the `postinstall` script, not by pnpm.
- Do not remove or bypass `scripts/setup-obsbot-sdk.mjs` without an equivalent native-addon build path.
- Keep `src/obsbot-sdk.d.ts` in sync with `src/server.ts` usage so `pnpm typecheck` stays green; the typecheck config depends on this file.
- Preserve the WebSocket message contract and the `/ws` path, `/healthz`, and the static `public/` serving unless the task is explicitly to change them; the UI in `public/index.html` depends on them.
- Do not commit `node_modules/`, build output, `.env*`, or `.direnv/` (see `.gitignore`).
