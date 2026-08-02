# What Just Hit Me — Desktop app (Tauri 2): build, deploy & ship

This document is for **you, the developer**. It explains how to turn the web game
into a downloadable Windows installer, where the installer comes out, how to point
the game at your public multiplayer server, how to deploy that server, and how
players install and play.

**Two separate things — do not confuse them:**

| Thing | Who does it | How often |
|-------|-------------|-----------|
| **The game client** (installer) | you build it, players install it | build once per release; players install once |
| **The multiplayer server** | you deploy it to a public host | deploy once, keep it running |

The **installer only sets up the player's game client.** It does **not** deploy the
server. The shared online server is deployed by you, separately, one time.

Players need only: the installed game, an internet connection, and a room code. They
never install Node, Rust, npm, a server, or configure anything.

---

## 1. One-time developer prerequisites (Windows)

To *build* the installer you need (players need none of this):

1. **Node.js LTS** — <https://nodejs.org>
2. **Rust** — <https://rustup.rs> (run `rustup-init.exe`, accept defaults)
3. **Microsoft C++ Build Tools** — install "Visual Studio Build Tools" and tick
   **Desktop development with C++** (Tauri compiles native code with MSVC).
   <https://visualstudio.microsoft.com/visual-studio-build-tools/>
4. **WebView2 runtime** — already on Windows 10/11; if not,
   <https://developer.microsoft.com/microsoft-edge/webview2/>.

Then, in the project root (the folder with `package.json`):

```bash
npm install          # installs `ws` (server) + @tauri-apps/cli (build tool)
```

Tauri docs / prerequisites: <https://tauri.app/start/prerequisites/>

---

## 2. Deploy the public multiplayer server (once)

The server lives in `server/` and is a normal Node app (`npm start`). Deploy it to
any persistent Node host — **[DEPLOY-ONLINE.md](DEPLOY-ONLINE.md)** walks through a
free Render deploy step by step. In short:

- Push this repo to GitHub, create a Render **Web Service** (Free), Build =
  `npm install`, Start = `npm start`.
- Render gives you a URL like `https://what-just-hit-me.onrender.com`.
- The WebSocket endpoint is that URL with **`wss://`** and path **`/ws`**, i.e.
  `wss://what-just-hit-me.onrender.com/ws`.

> The server binds `process.env.PORT` and serves the WebSocket at `/ws`, so it works
> on Render/Railway/Fly/etc. with no changes. WebSockets are required — a plain
> static host (Netlify/Vercel functions) will **not** work.

Keep this server running; every installed game connects to it.

---

## 3. Point the game at your server (single source of truth)

Edit **`js/net-config.js`** and set `serverUrl` to your deployed WebSocket URL:

```js
const NETWORK_CONFIG = {
  serverUrl: "wss://what-just-hit-me.onrender.com/ws",   // <-- your server
  protocolVersion: 1,
  connectionTimeoutMs: 10000,
  reconnectAttempts: 3
};
```

That's the **only** place a server URL lives. The `/ws` path is added automatically
if you omit it. (If you leave the `REPLACE_WITH_PRODUCTION_SERVER` placeholder, the
game falls back to same-origin — handy for `npm start` local testing, but the
installed app must have a real URL.)

---

## 4. Generate app icons (required once)

Tauri needs real icon files. From the project root:

```bash
npm run tauri icon path\to\your-logo.png     # square PNG, ideally 1024x1024
```

This fills `src-tauri/icons/` with every size/format. Any square PNG works to start.

---

## 5. Build the Windows installer

```bash
npm run tauri build
```

What happens: `beforeBuildCommand` runs `npm run build:frontend` (copies the web game
into `dist/`), then Tauri compiles the native shell and bundles the **NSIS installer**.

**Output location:**

```
src-tauri/target/release/bundle/nsis/What Just Hit Me_13.4.0_x64-setup.exe
```

That `*-setup.exe` is what you give players.

To iterate quickly without building an installer, use dev mode (opens the app in a
live window):

```bash
npm run tauri dev
```

---

## 6. How players install & launch

1. Player downloads `What Just Hit Me_..._x64-setup.exe` (from you — your site, a
   release page, etc.).
2. Runs it — a normal Windows installer. It installs the game and creates **Start
   Menu / desktop shortcuts**.
3. Launches **What Just Hit Me** from the shortcut — a real app window opens (no
   browser, no terminal).
4. Main menu: **LOCAL PLAY · MULTIPLAYER · SETTINGS · EXIT**.

*(First launch may prompt to install the WebView2 runtime on very old Windows; it's a
one-click Microsoft component. Windows 10/11 already have it.)*

---

## 7. How private rooms work (in-game)

- **MULTIPLAYER → CREATE PRIVATE ROOM:** the game connects to your server
  automatically, makes a private 2-player room, and shows a **6-character code** with
  a **Copy Code** button and "WAITING FOR PLAYER 2…".
- **MULTIPLAYER → type code → JOIN PRIVATE ROOM:** the code is upper-cased and the
  game joins that room. Friendly errors for invalid / missing / full rooms and update
  required.
- Both players land in a **synchronized lobby** (each picks their own fighter, sees
  match rules + ping, marks **READY**; the host starts once both are ready).
- In-match, each player uses **their own local Player-1 controls**. Only **semantic
  actions** (`left, right, jump, block, crouch, attack, ability1..3, ultimate`) cross
  the network — never keyboard key names.

---

## 8. Version compatibility

On connect, the client sends:

```js
{ type: "hello", gameVersion: "13.4", protocolVersion: 1 }
```

The server compares `protocolVersion` against its own `SERVER_PROTOCOL_VERSION`
(`server/server.js`). If they differ, the client gets `version_mismatch` and shows an
**"UPDATE REQUIRED"** message instead of entering a room — so an out-of-date installed
game can't join and desync.

**When you ship a breaking netcode change:** bump `protocolVersion` in BOTH
`js/net-config.js` and `SERVER_PROTOCOL_VERSION` in `server/server.js`, deploy the
server, and release a new installer. (`gameVersion` / `GAME_VERSION` is a display
string; compatibility is decided by `protocolVersion`.)

---

## 9. Future: automatic updates (optional)

Right now, updating players means shipping a new installer. To add silent
self-updates later, use the **Tauri Updater plugin**:

1. `npm run tauri add updater` (adds `@tauri-apps/plugin-updater` + the Rust plugin).
2. Generate signing keys (`npm run tauri signer generate`) and set the public key in
   `tauri.conf.json` (`plugins.updater`).
3. Host an **update manifest** (JSON) + the signed build artifacts somewhere public
   (e.g. GitHub Releases).
4. Point the updater `endpoints` at that manifest; the app checks on launch and
   installs updates.

Docs: <https://tauri.app/plugin/updater/>. This pairs naturally with the
`protocolVersion` gate above (force-update when the protocol changes).

---

## 10. macOS / Linux later

The project is already cross-platform. To add other targets, build **on that OS**
(Tauri builds native per-platform; a Windows machine can't produce a `.dmg`):

- **macOS:** `npm run tauri build` on a Mac → `.dmg` / `.app` in
  `src-tauri/target/release/bundle/`. `bundle.targets` can be `["nsis","dmg","appimage","deb"]`.
- **Linux:** `npm run tauri build` on Linux → AppImage / `.deb`.
- Or use CI (GitHub Actions has a Tauri build action) to produce all three from one
  workflow.

---

## File map (desktop-specific)

```
src-tauri/
├── tauri.conf.json        # window, bundle (NSIS), frontendDist=../dist, CSP
├── Cargo.toml             # Rust crate + tauri deps
├── build.rs               # tauri-build
├── src/main.rs, lib.rs    # native entry -> hosts the webview
├── capabilities/default.json  # window permissions (EXIT button = window close)
└── icons/                 # generated by `npm run tauri icon`
scripts/build-frontend.js  # copies RUN_GAME.html + js/css/characters/assets -> dist/
js/net-config.js           # THE server URL + protocol version (single source)
dist/                      # generated bundle input (gitignored)
```
