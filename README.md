# What Just Hit Me — Refactored (alpha 13.4)

**New in 13.4:** private **online 1v1** over a six-character room code
(host-authoritative), and an **installable Windows desktop app** (Tauri 2) whose main
menu is **LOCAL PLAY · MULTIPLAYER · SETTINGS · EXIT**. Players install the game, open
it, and create/join private rooms by code — no Node, no browser, no setup. See
[Online Play](#online-play) for how it works, **[DESKTOP-BUILD.md](DESKTOP-BUILD.md)**
to build the installer + deploy the shared server, and
**[DEPLOY-ONLINE.md](DEPLOY-ONLINE.md)** for the free server deploy. Every local mode
is unchanged.

A modular, editable restructuring of the single-file game
`what-just-hit-me_alpha13.1.html` (which is preserved, untouched, one folder up).

Same game, same characters, same art, same combat — but the embedded base64 art
is now real files, the CSS is split out, **each character is its own module**, and
the most commonly edited values (config, controls) plus a full **in-game settings
system** live in small, well-documented files.

---

## ⚠️ Current state (read this first)

The migration used a **"pragmatic runnable split"** so the game keeps working at
every step and can be verified in a browser as it evolves. Where things stand now:

**Fully externalized / modular**
- All **163 sprite / stage / projectile / effect images** are extracted to
  `assets/…` — **no base64 remains** in any HTML/CSS/JS.
- **CSS** is split into `css/` (variables, base, menus, character-select, fight,
  settings).
- **Config** (`js/config.js`) and **controls** (`js/controls.js`) are standalone,
  documented modules.
- **Every character is peeled into its own `characters/<id>.js`** (9 files). They
  load after `engine.js` and populate the engine's registries; `bootGame()` then
  sorts them by `ROSTER_ORDER` and builds the select grid.
- A complete **settings system** (`js/settings.js`, `js/settings-ui.js`,
  `css/settings.css`) — see the dedicated section below.

**Still consolidated in `js/engine.js`**
- The Fighter class, combat, AI, camera, projectiles, effects, rendering, HUD,
  screens, input, and round/match logic. The **per-character data + bespoke
  mechanics** now live in `characters/*.js`; the shared engine that drives them
  stays here.
- **Stages** are not yet peeled — `stages/` is an empty placeholder.

> **Testing note:** this project is assembled and verified **structurally** (brace/
> paren balance, no ES-module syntax, no cross-script global-name collisions, load
> order correct, asset paths resolve). It is **not** auto-run in a browser during
> editing (the editing environment has no browser/Node), so please playtest — see
> the Verification checklist at the bottom.

---

## Project structure

```
what-just-hit-me_alpha13.4/
├── RUN_GAME.html               # entry point; loads all scripts as plain <script> tags
├── README.md
├── package.json                # npm start -> node server/server.js (needs `ws`)
│
├── server/                     # online play back end (Node, host-authoritative relay)
│   ├── server.js               # HTTP static serving + WebSocket relay (one process)
│   └── room-manager.js         # in-memory private two-player rooms + validation
│
├── css/
│   ├── variables.css           # theme colors + --game-display-width
│   ├── base.css                # resets, body, #app shell, shared utils, kbd
│   ├── menus.css               # title, pause, victory screens
│   ├── character-select.css    # roster grid, cards, bio panels, select controls
│   ├── fight.css               # canvas, announce overlay, control helper
│   ├── settings.css            # settings overlay, tabs, widgets, fullscreen letterbox
│   └── online.css              # online menu, lobby, fighter picker, match menu
│
├── js/
│   ├── config.js               # GAME_CONFIG (all tunable numbers) + applyViewport()
│   ├── controls.js             # CONTROLS defaults (P1 new / P2 preserved) + keyLabel() + validators
│   ├── settings.js             # settings model: load/save/validate, active+pending, effective helpers
│   ├── engine.js               # shared game engine (classic script; see note)
│   ├── settings-ui.js          # settings overlay DOM, tabs, key-capture, apply/cancel
│   ├── online-state.js         # ONLINE session, serialization, snapshots, interpolation
│   ├── network-client.js       # WebSocket transport + protocol dispatch
│   ├── online-ui.js            # online menu, lobby, fighter picker, match menu, post-match
│   └── main.js                 # runs LAST: bootGame(), applies saved settings, paints control labels
│
├── characters/                 # one module per fighter (loaded after engine.js)
│   ├── haydar.js  satori.js  no-talking-man.js  necaati.js  necmi.js
│   └── putuk.js   agron.js   munevver.js        warbringer.js
│
├── stages/                     # (target of the per-stage peel; empty for now)
│
├── assets/
│   ├── characters/<id>/*.png   # every fighter sprite state (idle, attack, run…, skills, ult…)
│   ├── projectiles/*.png       effects/*.png   stages/kabatepe/background.png   ui/
│
└── tools/                      # one-off migration scripts + asset-manifest.json
    ├── extract-assets.pl  build-engine.pl  peel-haydar.pl  peel-char.pl
    └── asset-manifest.json     # id → state → {file, w, h, dx, foot}
```

**Why plain `<script>` tags (not ES modules):** ES modules are blocked by browsers
over `file://` (CORS), which would force you to run a local server just to open the
game. Classic scripts share one global lexical scope, so `config.js`/`controls.js`/
`settings.js` define the globals the engine uses (`CFG`, `CONTROLS`, `activeSettings`,
`P1KEYS`, …) and the character modules add to the engine's registries. Load order in
`RUN_GAME.html`:

```
config → controls → settings → engine → characters/*.js → settings-ui
       → online-state → network-client → online-ui → main
```

Local play still works by **double-clicking `RUN_GAME.html`** (`file://`). Online Play
requires the server (below); over `file://` the Online menu shows a message saying so.

This runs by **double-clicking `RUN_GAME.html`** *and* from a web server.

---

## Running the game

**Simplest: double-click `RUN_GAME.html`.** It opens over `file://` and just works —
no server needed. Then click **LOCAL PLAY**. (The player-facing release is the
installed desktop app — see [DESKTOP-BUILD.md](DESKTOP-BUILD.md).)

It also runs from a static web server (e.g. `python3 -m http.server` or `npx serve .`),
which is only *required* if you convert the plain scripts back into ES modules.

---

## Settings system

An in-game settings overlay, reachable from **both** the title screen (SETTINGS
button) and the **pause menu**. Exiting from the pause menu returns to the pause
menu (it does not auto-resume). There is **no audio category** — the game has no
audio system.

**Files**
- `js/settings.js` — the data model and logic (no DOM):
  - `DEFAULT_SETTINGS` with five groups: `match`, `controls`, `visuals`,
    `accessibility`, `practice`.
  - Safe `loadSettings()` / `saveSettings()` to `localStorage` under
    `what-just-hit-me-settings-v1`, with deep-merge onto defaults + `validateSettings()`
    (clamp/coerce every field). Unlimited round time is stored JSON-safely as the
    string `"unlimited"` and read back through `getRoundTimeValue()`.
  - `activeSettings` (in effect) vs `pendingSettings` (being edited).
  - **Effective helpers the engine reads each frame:** `SETTINGS_shakeScale()`,
    `SETTINGS_bgAnim()`, `SETTINGS_combatText()`, `SETTINGS_reducedFlashing()`,
    `SETTINGS_playerLabels()`, `SETTINGS_roundTime()`, `SETTINGS_roundsToWin()`,
    `SETTINGS_practiceInfiniteHP(f)`.
  - **Apply helpers:** `SETTINGS_applyControls()` (push bindings into `CONTROLS`,
    rebuild `P1KEYS`/`P2KEYS` + labels), `SETTINGS_applyCpu()`,
    `SETTINGS_applyVisualDom()` (body classes + control-helper visibility),
    `SETTINGS_applyFullscreen()` (Fullscreen API on `#app` + **Keyboard Lock** so a
    quick Esc pauses instead of leaving fullscreen), and `applySettings()`.
- `js/settings-ui.js` — the overlay DOM, tabs, widgets (steppers/toggles), the key-
  remap capture + conflict dialogs, and `openSettings()/closeSettingsReturn()/
  applySettingsUI()/cancelSettings()/restoreDefaultsUI()`. The overlay is mounted
  **inside `#app`** so it stays visible while `#app` is fullscreen.
- `css/settings.css` — pixel-art styling, plus the fullscreen letterbox centering
  and the `large-menu-text` / `reduced-flashing` helper rules.

**Tabs**
- **MATCH** — CPU Difficulty (Novice/Warrior/Celestial/Practice; syncs `cpuDiff` and
  the select-screen dropdown; may apply mid-match), Round Time (30/60/90/**Unlimited**
  → HUD shows `∞`, no timeout), Rounds to Win (1/2/3), Pause When Unfocused.
- **CONTROLS** — full remap for P1 and P2, with capture ("PRESS KEY… / ESC to
  cancel"), same-player conflict → REPLACE(swap)/CANCEL, cross-player warning, and
  RESET P1 / P2 / ALL. Labels repaint live via `refreshControlLabels()` — no reload.
- **VISUALS** — Fullscreen, Background Animation (keeps the painting, stops the
  decorative motion), Combat Text (hides only floating numbers), Control Helper
  (Always / Menus Only / Off).
- **PRACTICE** (appears only when CPU Difficulty = Practice) — Dummy Behavior
  (Stand/Fight/Block), Player/Dummy Health (Normal/Infinite), Energy, Cooldowns,
  plus **Reset Positions** and **Clear Status Effects** action buttons.

**Apply timing:** most settings take effect immediately on **Apply**. **Round Time**
and **Rounds to Win** are captured into `matchRoundTime` / `matchWinsRequired` at
match start, so changing them mid-fight shows "APPLIES NEXT MATCH" and doesn't
disturb the current match. **Cancel** discards pending edits; **Restore Defaults**
resets the pending copy (not saved until Apply).

**Accessibility** — the category still exists in the data model (Reduce Motion,
Reduced Flashing, Large Menu Text, Always Show P1/P2 Labels) and its effective
helpers still run, but the **tab is hidden for now**. Values stay at their defaults
(player labels on; the rest off). Re-add the tab in `settings-ui.js` (`TABS` array +
the ACCESSIBILITY render block) to expose it again.

---

## Editing guide (concrete)

### Camera width / viewport / world — `js/config.js`
`GAME_CONFIG` holds every tunable number, verified against 13.1:

```js
viewport: { width: 720, height: 270, renderScale: 2 }
world:    { width: 2032, ground: 249, gravity: 1200, leftWall: 652, rightWall: 1638 }
match:    { roundTime: 60, winsRequired: 2, maximumEnergy: 100 }
fighters: { scale: 0.72, player1Spawn: 900, player2Spawn: 1180 }
camera:   { followSpeed: 4.5 }
```

- **Change camera width** → `viewport.width`. The engine reads `W = CFG.viewport.width`
  (camera window, clamping, HUD width, stage crop), and `applyViewport()` sets the
  canvas backing resolution (`width * renderScale`) **and** the `--game-display-width`
  CSS variable. A wider value reveals **more of the stage** (not a stretched picture).
- **Round time / wins:** `match.roundTime` / `match.winsRequired` are the *baseline*
  defaults; the in-game **Settings → MATCH** tab overrides them at runtime (saved to
  localStorage) via `SETTINGS_roundTime()` / `SETTINGS_roundsToWin()`.

### Controls + automatic labels — `js/controls.js`
```js
CONTROLS.p1 = { left:"a", right:"d", jump:" ", block:"u", crouch:"s",
                attack:"i", abilities:["j","k","l"], ultimate:"o" };
```
`controls.js` defines the **defaults**; the in-game **Settings → CONTROLS** tab remaps
them at runtime and persists to localStorage. Every on-screen label is generated via
`keyLabel()` / `abilityLabels()` / `ultimateLabel()` (title + fight helpers built in
`main.js`, character-select labels, HUD cooldown/ult labels) — no hardcoded key text.

**Current Player 1 defaults:** `A` left · `D` right · `SPACE` jump · `U` block ·
`S` crouch · `I` attack · `J`/`K`/`L` abilities · `O` ultimate.

**⚠️ P1 / P2 default key overlap:** P2 defaults are preserved from 13.1
(`←`/`→` move, `↑` jump, `↓` crouch, `I` block, `K` attack, `L`/`O`/`P` abilities,
`M` ult), which collide with P1's `I`/`K`/`L`/`O` in **local 2-player only** (CPU mode
is unaffected). Players can now fix this themselves in **Settings → CONTROLS** instead
of editing code.

### Characters — `characters/<id>.js` (one module each)
Each character module runs after `engine.js` and **adds its data to the engine's
registries** (no top-level declarations, so modules never collide):
`CHARS.push({...})` (stats/name/bio/`ab`/`ult`), `IMG_SPRITES.<id>`, `ABILITIES.<id>`,
`ULTS.<id>`, and optional `EXTRAS`/`EXTRAS_BEHIND`/`WIN_LINES`/`PROJ_IMGS`/`FX_IMGS`.

- **Edit a hero's stats / abilities / ult:** open `characters/<id>.js` — `hp, armor,
  speed, jump`, basic-attack damage, the three `ABILITIES.<id>` slot functions, and
  `ULTS.<id>` are all in that one file.
- **Roster order:** fixed by `ROSTER_ORDER` in `engine.js` (independent of load order).
- **Add a character:** create `characters/<id>.js` that populates the registries, drop
  art in `assets/characters/<id>/`, add its `<script>` tag in `RUN_GAME.html`, and add
  its id to `ROSTER_ORDER`.
- **Remove / lock a character:** `ember` and `akira` were removed from the roster;
  `COMING_SOON = ["necaati"]` (in `engine.js`) renders a fighter greyscale with a
  "COMING SOON" overlay and makes it unselectable.

### Replacing sprites, and how dimensions/offsets work
Sprites are plain files: `assets/characters/<id>/<state>.png`. **Swap the file** to
change the art — keep it a transparent PNG (source PNGs are 2× for crisp
supersampling). Per-state display size/offsets live in each character's
`IMG_SPRITES.<id> = { idle:{w,h,dx,foot,src}, … }`: `w`/`h` = draw size, `dx` =
horizontal nudge, `foot` = vertical nudge (keeps feet planted across poses).
`tools/asset-manifest.json` lists every state's file + w/h/dx/foot.

---

## Which code does what
- **`engine.js` — gameplay:** Fighter class + `updateFighter` (movement/jump/block/
  crouch, status timers), `takeDamage` (armor/barrier/shield/crit/knockback/heal/
  energy), AI (`aiControl`), round/match/timer logic, input, camera.
- **`engine.js` — rendering:** `drawStage`, `drawFighter` (+ per-hero `EXTRAS`
  overlays), projectile/effect draw, `drawHUD`.
- **`characters/*.js`:** all per-hero data + bespoke mechanics.
- **`settings.js` / `settings-ui.js`:** the settings model + overlay (above).
- **`main.js`:** boots the roster, applies saved settings, exposes
  `refreshControlLabels()`, wires the title SETTINGS button.
- **`server/*.js`, `js/online-*.js`, `js/network-client.js`:** online play (below).

---

## Online Play

Private **1v1 over a room code**, added in 13.4. It is **host-authoritative**, not
rollback netcode (see the honest limitations at the end).

### Architecture / host-authoritative model
- One **Node process** (`server/server.js`) both serves the static game over HTTP
  **and** runs the WebSocket relay at `/ws`. `server/room-manager.js` keeps private
  two-player rooms in memory.
- The **host browser runs the entire authoritative simulation** (`updateSimulation`).
  The **guest** forwards *semantic* inputs and renders **interpolated snapshots**
  (`renderGame` only — it never simulates combat).
- The **server never simulates or decides outcomes.** It validates message shape /
  authority / room membership and relays: guest inputs → host, host snapshots →
  guest, lobby/match events between the two.

### Install & run the server
```bash
npm install       # installs the one dependency, `ws`
npm start         # -> node server/server.js
```
It prints `What Just Hit Me server running at http://localhost:8080` (port =
`process.env.PORT || 8080`). The root URL serves `RUN_GAME.html`.

### Test with two browser tabs
1. `npm start`, then open **http://localhost:8080** in two tabs (or two windows).
2. Tab A: **MULTIPLAYER → CREATE PRIVATE ROOM** → a six-character code appears
   (`WAITING FOR PLAYER 2…`). Copy it.
3. Tab B: **MULTIPLAYER**, type the code, **JOIN PRIVATE ROOM**.
4. Both: **SELECT FIGHTER**, then **READY**. The host's **START MATCH** appears once
   both are ready; the match begins on both tabs.

### Ship it to players (the real way — different networks, join by code)

The player-facing release is the **installable desktop app** connecting to your
**one deployed server**. There are no per-session launchers or links.

1. **Deploy the server once** → **[DEPLOY-ONLINE.md](DEPLOY-ONLINE.md)** (free Render
   deploy). You get a `wss://…/ws` URL.
2. **Build the installer** → **[DESKTOP-BUILD.md](DESKTOP-BUILD.md)**: put that URL in
   `js/net-config.js`, then `npm run tauri build`.
3. Players run the installer, launch the game, and use **MULTIPLAYER → CREATE / JOIN**
   by 6-letter code. Nothing to install but the game; no browser, no links.

The client picks its server from `js/net-config.js` (`NETWORK_CONFIG.serverUrl`), and
falls back to the page's own origin when that's left as the placeholder — so
`npm start` on localhost and a same-origin web deploy also work with no code changes.

### Message protocol (JSON over WebSocket)
Signalling / lobby: `create_room` · `room_created` · `join_room` · `room_joined` ·
`room_error` · `lobby_state` · `select_character` · `set_ready` · `set_rules` ·
`start_match`. Gameplay: `input` · `input_state` (held-map heartbeat) · `snapshot` ·
`match_event` (announce / match_victory / rematch_start). Lifecycle: `rematch_vote` ·
`return_to_lobby` · `leave_room` · `ping` / `pong` · `opponent_disconnected` /
`host_disconnected`. The server enforces: allowed types, max message size (64 KB),
valid room-code format, playable (non–`COMING SOON`) character ids, boolean
ready/`down` values, allowed semantic actions, **only the host may send snapshots**,
and room membership. Malformed JSON and unknown fields are ignored — never `eval`.

### Online controls (semantic, not raw keys)
Each player uses **their own local `activeSettings.controls.p1`** profile
(A/D move · SPACE jump · U block · S crouch · I attack · J/K/L skills · O ULT by
default). Keys are converted to **semantic actions** —
`left,right,jump,block,crouch,attack,ability1,ability2,ability3,ultimate` — before
sending, so each computer can rebind freely without the other knowing its keys. The
guest sends **key-down/key-up transitions** plus a ~300 ms **held-map heartbeat**
(so a dropped key-up can't leave an action stuck); on the host the online opponent is
a fighter with control type **`remote`** (never treated as CPU). The fight helper
shows only *your* controls.

### Snapshots & interpolation
- The host sends **~20 snapshots/second** (`ONLINE_SNAPSHOT_RATE`) containing
  **gameplay state only** — fighter fields, projectiles, platforms/props, timer,
  round/wins, camera, and small readability arrays (floating combat text, rings).
  Never pixels, images, or the stage background (both browsers already have the art).
- Serialization is **explicit** (`serializeOnlineGameState` /
  `serializeOnlineFighter` / `serializeOnlineProjectile`): it copies primitives,
  drops functions/DOM/images, and stores references (owner / seized fighter) as
  **fighter indexes**. The guest keeps real `Fighter` instances (so getters like
  `centerY`, `hurtY`, `rect()` keep working) and applies snapshot fields to them.
- The guest **interpolates** continuous positions (fighter X/Y, camera, projectiles)
  between the previous and target snapshots with a ~1-snapshot delay, and **snaps**
  discrete values (HP, armor, state, alive, wins, cooldowns). Very late snapshots
  hold at the latest authoritative value rather than extrapolating.

### Which player is authoritative / why online can't pause
The **host** decides every gameplay outcome — critical hits, misses, damage, status,
platform destruction, timeout ties, round winners. The guest never decides any of
these; it shows the host's results. Online matches therefore **do not pause**: Esc
opens an **online match menu** (Return / Settings / Leave) while the host keeps
simulating, and losing window focus releases your held inputs instead of pausing. The
`Pause When Unfocused` setting is ignored online. Settings changed mid-match only
affect **local presentation/controls** (fullscreen, background animation, combat
text, control helper, key bindings); CPU difficulty, Practice, Round Time and Rounds
to Win do not apply to a live online match (round rules were captured from the host's
lobby selection).

### Disconnection & rematch
- **Guest leaves:** host sees `PLAYER 2 DISCONNECTED`, remote input is neutralized,
  offering Online Lobby / Main Menu.
- **Host leaves:** guest sees `HOST DISCONNECTED`, the room closes, guest returns to
  the Online menu (no host migration in this version).
- **Unhealthy link:** a `CONNECTION UNSTABLE — RECONNECTING…` banner shows after ~5 s
  of silence; a hard drop fails cleanly (never a frozen game).
- **Rematch** requires **both** players to vote (`WAITING FOR OPPONENT…`); on two
  yes-votes the same fighters restart with the same rules. Choosing **Character
  Select** returns both to the synchronized lobby (ready state cleared).

### This is NOT rollback netcode
The host favors itself; the **guest can feel input delay** roughly equal to the
round-trip time, and decorative particles / Münevver's Codex swirl are host-only
visuals on the guest (their *gameplay* results still sync). Delayed host callbacks
(`setTimeout`) still run on the host as in 13.1; online round/match/session epoch ids
(`onlineSessionId` / `onlineMatchId` / `onlineRoundId`) guard the engine's own
round-advance and basic-attack callbacks so a stale one can't affect a later online
round or rematch — but the per-character ability/ult `setTimeout`s are **not** yet
epoch-guarded (host-authoritative and guarded on `!running`; full guarding is future
work). Randomness is split into **gameplay-authoritative** (host only: crits, misses,
timeout ties, status, platform breaks, AI) and **visual-only** (particles/shake,
which may differ harmlessly between the two screens). The game is **not** claimed to
be deterministic.

**What a future rollback version would require:** a fixed timestep, replacing every
gameplay `setTimeout` with simulation-frame timers, deterministic gameplay randomness
(seeded PRNG), full save/restore of simulation state, an input history buffer, and
re-simulation on late inputs.

---

## Known limitations
1. `engine.js` still holds the shared game systems (per-hero data is peeled; stages are not).
2. `stages/` is empty until the stage peel.
3. **Pause vs. delayed hits:** the loop freezes on pause, but 13.1 schedules some hits
   with `setTimeout` (guarded on `!running`, not on `paused`), so a delayed hit can
   still resolve during a pause. Carried over unchanged from 13.1; not a permanent
   cancel. The correct fix (loop-managed timers keyed off `tGlobal`) is future work.
4. P1/P2 default key overlap in local 2-player (now user-fixable in Settings).
5. **Online is host-authoritative, not rollback** — the guest can feel input delay
   (~round-trip time); per-character ability `setTimeout`s aren't epoch-guarded yet;
   only one stage, so no stage voting. See [Online Play](#online-play).
6. Not auto browser-tested — playtest recommended (online: `npm install && npm start`,
   two tabs on `http://localhost:8080`).

## Verification checklist (please run in a browser)
Startup/menus · MAIN MENU button returns from select · every character selectable
(necaati greyed "COMING SOON") · P1 keys + labels · remap keys in Settings and see
labels update live · CPU + Human-P2 + all difficulties + Practice options · movement/
jump/block/crouch/attack · damage/armor/energy/cooldowns/status/projectiles/knockback ·
round timer (incl. **Unlimited → ∞**) / wins / match victory / timeout · pause+resume ·
**fullscreen** (Esc pauses via Keyboard Lock on Chrome/Edge; even letterbox, not a
black half) · rematch · stage bg + camera scroll + HUD.

**Online (two tabs on `http://localhost:8080`):** create room → code shows · join with
code · third joiner rejected (`ROOM IS FULL`) · bad code rejected · both select
different fighters · ready/unready · START only when both ready · guest controls P2 on
the host (move/jump/crouch/block/attack/abilities/ult, Haydar held-ult, Agron flight) ·
key release clears the remote action · focus loss sends neutral input · both tabs show
the same HP/armor/energy/timer/round score · projectiles + destructible platforms +
status effects sync · round/timeout/match results sync · guest interpolates without
teleporting · Esc opens the online match menu (no pause) · guest/host disconnect
handled · no remote key stays held after disconnect · rematch needs both votes ·
Character Select returns both to the lobby.
