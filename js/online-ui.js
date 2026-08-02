/**
 * What Just Hit Me — online UI (online menu, lobby, fighter picker, in-match menu,
 * post-match rematch voting, error toasts). Plain <script>, loaded last among the
 * online scripts (after online-state + network-client), before main.js.
 *
 * Builds its DOM under #app so showScreen("online"/"onlinelobby") integrates with
 * the existing screen system. Networking is delegated to network-client.js and
 * gameplay to online-state.js.
 */
"use strict";

/* ---------- error text mapping (never expose raw server exceptions) ---------- */
const ONLINE_ERRORS = {
  ROOM_NOT_FOUND: "ROOM NOT FOUND",
  ROOM_FULL: "ROOM IS FULL",
  INVALID_ROOM_CODE: "INVALID ROOM CODE",
  INVALID_CHARACTER: "INVALID FIGHTER",
  FAILED_MATCH_START: "FAILED TO START MATCH — both players must be ready",
  CONNECTION_FAILED: "COULD NOT REACH THE SERVER. Check your internet connection and try again.",
  CONNECTION_TIMEOUT: "CONNECTION TIMED OUT. Check your internet connection and try again.",
  UNSUPPORTED: "THIS DEVICE DOES NOT SUPPORT ONLINE PLAY (no WebSocket).",
  VERSION_MISMATCH: "UPDATE REQUIRED — your game is out of date. Please install the latest What Just Hit Me to play online.",
  FILE_PROTOCOL: "Online Play needs the game server. In a terminal run  npm install  then  npm start  and open http://localhost:8080"
};

let ONLINE_rematchVoted = false;

function oel(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

/* ================================================================
 * DOM CONSTRUCTION (once)
 * ================================================================ */
let ONLINE_UI_built = false;
function ONLINE_buildDOM() {
  if (ONLINE_UI_built) return; ONLINE_UI_built = true;
  const app = document.getElementById("app");

  /* ---- ONLINE MENU (screen) ---- */
  const menu = oel("section", "screen"); menu.id = "online";
  menu.innerHTML =
    '<h2 class="online-title">MULTIPLAYER</h2>' +
    '<div class="online-panel">' +
      '<button class="online-big" id="onlineCreateBtn">CREATE PRIVATE ROOM</button>' +
      '<div class="online-or">— or —</div>' +
      '<label class="online-label">ROOM CODE</label>' +
      '<input id="onlineCodeInput" class="online-code-input" maxlength="6" autocomplete="off" spellcheck="false" placeholder="______">' +
      '<button class="online-big" id="onlineJoinBtn">JOIN PRIVATE ROOM</button>' +
      '<div id="onlineMenuMsg" class="online-msg"></div>' +
    '</div>' +
    '<button class="online-back" id="onlineBackBtn">← BACK</button>';
  app.appendChild(menu);

  /* ---- ONLINE LOBBY (screen) ---- */
  const lobby = oel("section", "screen"); lobby.id = "onlinelobby";
  lobby.innerHTML =
    '<h2 class="online-title">ONLINE LOBBY</h2>' +
    '<div class="lobby-top"><span>ROOM: <b id="lobbyCode">------</b></span>' +
      '<button id="lobbyCopyBtn" class="online-copy">COPY CODE</button>' +
      '<span class="lobby-ping">PING: <b id="lobbyPing">--</b> ms</span></div>' +
    '<div class="lobby-players">' +
      '<div class="lobby-card" id="lobbyP1"><div class="lobby-role p1">PLAYER 1 — HOST</div>' +
        '<div class="lobby-fighter" id="lobbyP1Char">—</div><div class="lobby-status" id="lobbyP1Status">SELECTING</div></div>' +
      '<div class="lobby-card" id="lobbyP2"><div class="lobby-role p2">PLAYER 2</div>' +
        '<div class="lobby-fighter" id="lobbyP2Char">—</div><div class="lobby-status" id="lobbyP2Status">WAITING…</div></div>' +
    '</div>' +
    '<div class="lobby-rules" id="lobbyRules">Round Time: 60s · Rounds to Win: 2</div>' +
    '<div class="lobby-buttons">' +
      '<button id="lobbySelectBtn" class="online-big">SELECT FIGHTER</button>' +
      '<button id="lobbyReadyBtn" class="online-big">READY</button>' +
      '<button id="lobbyStartBtn" class="online-big" style="display:none">START MATCH</button>' +
      '<button id="lobbyLeaveBtn" class="online-back">LEAVE ROOM</button>' +
    '</div>' +
    '<div id="lobbyMsg" class="online-msg"></div>';
  app.appendChild(lobby);

  /* ---- FIGHTER PICKER (overlay) ---- */
  const picker = oel("div"); picker.id = "onlinePicker";
  picker.innerHTML = '<div class="picker-box"><h3>SELECT YOUR FIGHTER</h3><div id="pickerGrid" class="picker-grid"></div><button id="pickerClose" class="online-back">CANCEL</button></div>';
  app.appendChild(picker);

  /* ---- IN-MATCH MENU (overlay; does NOT pause the host simulation) ---- */
  const mm = oel("div"); mm.id = "onlineMatchMenu";
  mm.innerHTML =
    '<div class="online-menu-box"><h2>ONLINE MATCH</h2>' +
    '<div class="online-menu-info">Opponent: <b id="omOpp">Connected</b> · Ping: <b id="omPing">--</b> ms</div>' +
    '<button id="omResume" class="online-big">RETURN TO GAME</button>' +
    '<button id="omSettings" class="online-big">SETTINGS</button>' +
    '<button id="omLeave" class="online-back">LEAVE MATCH</button></div>';
  app.appendChild(mm);

  /* ---- POST-MATCH (overlay; rematch voting) ---- */
  const pm = oel("div"); pm.id = "onlinePostMatch";
  pm.innerHTML =
    '<div class="online-menu-box"><h2 id="opmTitle">VICTORY</h2>' +
    '<p id="opmLore" class="online-msg"></p>' +
    '<div id="opmWait" class="online-msg" style="display:none">WAITING FOR OPPONENT…</div>' +
    '<button id="opmRematch" class="online-big">REMATCH</button>' +
    '<button id="opmSelect" class="online-big">CHARACTER SELECT</button>' +
    '<button id="opmLeave" class="online-back">LEAVE ROOM</button></div>';
  app.appendChild(pm);

  /* ---- toast / status banner ---- */
  const toast = oel("div"); toast.id = "onlineToast"; app.appendChild(toast);
  const unstable = oel("div"); unstable.id = "onlineUnstable"; unstable.textContent = "CONNECTION UNSTABLE — RECONNECTING…"; app.appendChild(unstable);

  ONLINE_wire();
}

/* ================================================================
 * WIRING
 * ================================================================ */
function ONLINE_wire() {
  document.getElementById("onlineBackBtn").addEventListener("click", () => { NET_close(); if (typeof showScreen === "function") showScreen("title"); });

  document.getElementById("onlineCreateBtn").addEventListener("click", ONLINE_createRoom);
  document.getElementById("onlineJoinBtn").addEventListener("click", ONLINE_joinRoom);

  const codeInput = document.getElementById("onlineCodeInput");
  codeInput.addEventListener("input", () => {
    codeInput.value = codeInput.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "").slice(0, 6);
  });
  codeInput.addEventListener("keydown", (e) => { if (e.key === "Enter") ONLINE_joinRoom(); });

  document.getElementById("lobbyCopyBtn").addEventListener("click", () => {
    const code = ONLINE.roomCode || "";
    if (navigator.clipboard) navigator.clipboard.writeText(code).catch(() => {});
    ONLINE_toast("COPIED " + code);
  });
  document.getElementById("lobbySelectBtn").addEventListener("click", ONLINE_openPicker);
  document.getElementById("lobbyReadyBtn").addEventListener("click", ONLINE_toggleReady);
  document.getElementById("lobbyStartBtn").addEventListener("click", () => NET_send({ type: "start_match" }));
  document.getElementById("lobbyLeaveBtn").addEventListener("click", ONLINE_leaveRoom);

  document.getElementById("pickerClose").addEventListener("click", () => document.getElementById("onlinePicker").classList.remove("show"));

  document.getElementById("omResume").addEventListener("click", () => ONLINE_toggleMatchMenu(false));
  document.getElementById("omSettings").addEventListener("click", () => { ONLINE_toggleMatchMenu(false); if (typeof openSettings === "function") openSettings("online"); });
  document.getElementById("omLeave").addEventListener("click", ONLINE_leaveMatch);

  document.getElementById("opmRematch").addEventListener("click", () => ONLINE_vote("rematch"));
  document.getElementById("opmSelect").addEventListener("click", () => ONLINE_vote("character_select"));
  document.getElementById("opmLeave").addEventListener("click", ONLINE_leaveRoom);

  // keep ping display fresh
  setInterval(() => {
    const lp = document.getElementById("lobbyPing"); if (lp && ONLINE.ping != null) lp.textContent = ONLINE.ping;
    const op = document.getElementById("omPing"); if (op && ONLINE.ping != null) op.textContent = ONLINE.ping;
  }, 1000);
}

/* ================================================================
 * MENU ACTIONS
 * ================================================================ */
function ONLINE_menuMsg(txt, isErr) { const m = document.getElementById("onlineMenuMsg"); if (m) { m.textContent = txt || ""; m.classList.toggle("err", !!isErr); } }

function ONLINE_openMenu() {
  ONLINE_buildDOM();
  ONLINE_menuMsg("");
  document.getElementById("onlineCodeInput").value = "";
  if (NET_isFileProtocol()) ONLINE_menuMsg(ONLINE_ERRORS.FILE_PROTOCOL, true);
  showScreen("online");
}

function ONLINE_createRoom() {
  ONLINE_menuMsg("Connecting…");
  NET_connect(
    () => NET_send({ type: "create_room" }),
    (reason) => ONLINE_menuMsg(ONLINE_ERRORS[reason] || "CONNECTION FAILED", true)
  );
}

function ONLINE_joinRoom() {
  const code = (document.getElementById("onlineCodeInput").value || "").toUpperCase();
  if (code.length !== 6) { ONLINE_menuMsg(ONLINE_ERRORS.INVALID_ROOM_CODE, true); return; }
  ONLINE_menuMsg("Connecting…");
  NET_connect(
    () => NET_send({ type: "join_room", roomCode: code }),
    (reason) => ONLINE_menuMsg(ONLINE_ERRORS[reason] || "CONNECTION FAILED", true)
  );
}

function ONLINE_leaveRoom() {
  NET_close();
  ONLINE_hideAllOverlays();
  if (typeof refreshControlLabels === "function") refreshControlLabels();
  showScreen("title");
}

/* ================================================================
 * LOBBY
 * ================================================================ */
function ONLINE_enterLobby() {
  document.getElementById("lobbyCode").textContent = ONLINE.roomCode || "------";
  document.getElementById("lobbyMsg").textContent = "";
  ONLINE_rematchVoted = false;
  // Host publishes its saved match rules so the guest sees them read-only.
  if (ONLINE.role === "host" && typeof activeSettings !== "undefined") {
    NET_send({ type: "set_rules", rules: { roundTime: activeSettings.match.roundTime, roundsToWin: activeSettings.match.roundsToWin } });
  }
  showScreen("onlinelobby");
}

function ONLINE_onRoomCreated() { ONLINE_enterLobby(); }
function ONLINE_UI_onRoomCreated() { ONLINE_enterLobby(); }
function ONLINE_UI_onRoomJoined() { ONLINE_enterLobby(); }
function ONLINE_UI_onRoomError(code) {
  // errors during join/create appear on the menu; if we somehow left, still show a toast
  const txt = ONLINE_ERRORS[code] || "CONNECTION FAILED";
  if (document.getElementById("online").classList.contains("active")) ONLINE_menuMsg(txt, true);
  else ONLINE_toast(txt);
}

function ONLINE_charName(id) { const d = CHARS.find(c => c.id === id); return d ? d.name.toUpperCase() : "—"; }

function ONLINE_UI_onLobbyState(s) {
  if (!document.getElementById("onlinelobby")) return;
  document.getElementById("lobbyCode").textContent = s.roomCode;
  document.getElementById("lobbyP1Char").textContent = "Fighter: " + ONLINE_charName(s.hostChar);
  document.getElementById("lobbyP2Char").textContent = "Fighter: " + ONLINE_charName(s.guestChar);
  document.getElementById("lobbyP1Status").textContent = s.hostReady ? "READY" : "SELECTING";
  document.getElementById("lobbyP2Status").textContent = !s.guestConnected ? "WAITING FOR PLAYER 2…" : (s.guestReady ? "READY" : "SELECTING");
  const rt = s.rules.roundTime === "unlimited" ? "∞" : (s.rules.roundTime + "s");
  document.getElementById("lobbyRules").textContent = "Round Time: " + rt + " · Rounds to Win: " + s.rules.roundsToWin + (ONLINE.role === "guest" ? "  (host's rules)" : "");

  // Reflect our own ready state on the button.
  const myReady = ONLINE.role === "host" ? s.hostReady : s.guestReady;
  document.getElementById("lobbyReadyBtn").textContent = myReady ? "UNREADY" : "READY";

  // Host START button appears only when both are connected, ready and valid.
  const startBtn = document.getElementById("lobbyStartBtn");
  const bothReady = s.hostReady && s.guestReady && s.guestConnected;
  if (ONLINE.role === "host") startBtn.style.display = bothReady ? "" : "none";
  else startBtn.style.display = "none";
}

function ONLINE_toggleReady() {
  const s = ONLINE.lobbyState; if (!s) return;
  // Can't ready up without a valid, playable fighter selected.
  const myChar = ONLINE.role === "host" ? s.hostChar : s.guestChar;
  const myReady = ONLINE.role === "host" ? s.hostReady : s.guestReady;
  if (!myReady && !myChar) { ONLINE_lobbyMsg("Select a fighter first."); return; }
  NET_send({ type: "set_ready", ready: !myReady });
}
function ONLINE_lobbyMsg(t) { const m = document.getElementById("lobbyMsg"); if (m) m.textContent = t || ""; }

/* ---- fighter picker ---- */
function ONLINE_openPicker() {
  const grid = document.getElementById("pickerGrid"); grid.innerHTML = "";
  CHARS.forEach(d => {
    const soon = COMING_SOON.includes(d.id);
    const card = oel("div", "picker-card" + (soon ? " soon" : ""));
    const cn = document.createElement("canvas"); cn.width = 96; cn.height = 100; card.appendChild(cn);
    const nm = oel("div", "picker-name", d.name); card.appendChild(nm);
    if (!soon) card.addEventListener("click", () => {
      NET_send({ type: "select_character", characterId: d.id });
      document.getElementById("onlinePicker").classList.remove("show");
    });
    grid.appendChild(card);
    if (typeof drawPortrait === "function") drawPortrait(cn, d);
  });
  document.getElementById("onlinePicker").classList.add("show");
}

/* ================================================================
 * MATCH FLOW
 * ================================================================ */
function ONLINE_showFightScreen() {
  ONLINE_hideAllOverlays();
  // Online fight helper shows only THIS player's local controls.
  const fh = document.getElementById("fightCtrlHelp");
  if (fh && typeof keyLabel === "function") {
    const c = activeSettings.controls.p1;
    const kb = k => `<kbd>${keyLabel(k)}</kbd>`;
    fh.innerHTML = "YOUR CONTROLS: " + kb(c.left) + kb(c.right) + " move · " + kb(c.jump) + " jump · " +
      kb(c.block) + " block · " + kb(c.crouch) + " crouch · " + kb(c.attack) + " attack · " +
      c.abilities.map(kb).join("") + " skills · " + kb(c.ultimate) + " ULT";
  }
  showScreen("fight");
}
function ONLINE_UI_onMatchStart() { /* fight screen shown by ONLINE_beginMatch */ }

function ONLINE_toggleMatchMenu(force) {
  const mm = document.getElementById("onlineMatchMenu");
  const show = (force === undefined) ? !mm.classList.contains("show") : force;
  document.getElementById("omOpp").textContent = ONLINE.opponentConnected ? "Connected" : "Disconnected";
  mm.classList.toggle("show", show);
}

function ONLINE_leaveMatch() {
  NET_send({ type: "leave_room" });
  ONLINE_endMatchLocal();
  ONLINE_reset();
  NET_close();
  ONLINE_hideAllOverlays();
  if (typeof refreshControlLabels === "function") refreshControlLabels();
  showScreen("title");
}

/* host victory entry point (called from online-state.ONLINE_hostVictory) */
function ONLINE_showPostMatch(winnerName) { ONLINE_showPost(winnerName); }
function ONLINE_UI_onMatchVictory(msg) { ONLINE_showPost(msg.winnerName); }

function ONLINE_showPost(winnerName) {
  ONLINE_rematchVoted = false;
  const pm = document.getElementById("onlinePostMatch");
  document.getElementById("opmTitle").textContent = (winnerName || "MATCH").toUpperCase() + " WINS!";
  const wid = CHARS.find(c => (c.name || "").toUpperCase() === (winnerName || "").toUpperCase());
  document.getElementById("opmLore").textContent = (wid && typeof WIN_LINES !== "undefined" && WIN_LINES[wid.id]) ? WIN_LINES[wid.id] : "";
  document.getElementById("opmWait").style.display = "none";
  document.getElementById("opmRematch").style.display = "";
  document.getElementById("opmSelect").style.display = "";
  ONLINE_toggleMatchMenu(false);
  pm.classList.add("show");
}

function ONLINE_vote(vote) {
  if (ONLINE_rematchVoted) return;
  ONLINE_rematchVoted = true;
  NET_send({ type: "rematch_vote", vote });
  document.getElementById("opmRematch").style.display = "none";
  document.getElementById("opmSelect").style.display = "none";
  document.getElementById("opmWait").style.display = "";
}
function ONLINE_UI_onRematchVote() { /* opponent voted; our own WAITING state already shows if we voted */ }

function ONLINE_UI_onRematchStart(msg) {
  document.getElementById("onlinePostMatch").classList.remove("show");
  const s = ONLINE.lobbyState;
  if (s) ONLINE_beginMatch(s.hostChar, s.guestChar, s.rules, msg.matchId);
}

function ONLINE_UI_onReturnToLobby() {
  ONLINE_hideAllOverlays();
  ONLINE_endMatchLocal();
  ONLINE_enterLobby();
}

/* ================================================================
 * DISCONNECTION
 * ================================================================ */
function ONLINE_UI_onOpponentDisconnected() {
  ONLINE.opponentConnected = false;
  ONLINE_endMatchLocal();
  ONLINE_hideAllOverlays();
  ONLINE_bigMessage("PLAYER 2 DISCONNECTED", [
    { label: "ONLINE LOBBY", act: () => { ONLINE_dismissBig(); ONLINE_enterLobby(); } },
    { label: "MAIN MENU", act: ONLINE_leaveRoom }
  ]);
}
function ONLINE_UI_onHostDisconnected() {
  ONLINE_endMatchLocal();
  ONLINE_hideAllOverlays();
  ONLINE_bigMessage("HOST DISCONNECTED", [
    { label: "BACK TO ONLINE", act: () => { ONLINE_dismissBig(); NET_close(); ONLINE_openMenu(); } }
  ]);
}
function ONLINE_UI_onConnectionLost() {
  // socket dropped unexpectedly (not a clean leave)
  if (document.getElementById("onlineBigMsg") && document.getElementById("onlineBigMsg").classList.contains("show")) return;
  ONLINE_hideAllOverlays();
  ONLINE_bigMessage("CONNECTION LOST", [
    { label: "BACK TO MENU", act: () => { ONLINE_dismissBig(); NET_close(); if (typeof refreshControlLabels === "function") refreshControlLabels(); showScreen("title"); } }
  ]);
}
function ONLINE_UI_setUnstable(on) {
  const u = document.getElementById("onlineUnstable"); if (u) u.classList.toggle("show", !!on);
}

/* ================================================================
 * HELPERS
 * ================================================================ */
function ONLINE_hideAllOverlays() {
  ["onlinePicker", "onlineMatchMenu", "onlinePostMatch", "onlineUnstable"].forEach(id => {
    const e = document.getElementById(id); if (e) e.classList.remove("show");
  });
}
function ONLINE_toast(txt) {
  const t = document.getElementById("onlineToast"); if (!t) return;
  t.textContent = txt; t.classList.add("show");
  clearTimeout(t._timer); t._timer = setTimeout(() => t.classList.remove("show"), 1800);
}
function ONLINE_bigMessage(title, buttons) {
  let box = document.getElementById("onlineBigMsg");
  if (!box) { box = oel("div"); box.id = "onlineBigMsg"; document.getElementById("app").appendChild(box); }
  box.innerHTML = "";
  const inner = oel("div", "online-menu-box"); inner.appendChild(oel("h2", null, title));
  (buttons || []).forEach(b => { const bt = oel("button", "online-big", b.label); bt.addEventListener("click", b.act); inner.appendChild(bt); });
  box.appendChild(inner); box.classList.add("show");
}
function ONLINE_dismissBig() { const b = document.getElementById("onlineBigMsg"); if (b) b.classList.remove("show"); }

/* Quit the game. In the installed Tauri desktop app this closes the window; in a
   browser it falls back to window.close() (which browsers may ignore for non-
   script-opened tabs). */
function ONLINE_exitGame() {
  const T = (typeof window !== "undefined") ? window.__TAURI__ : null;
  try {
    if (T && T.window && typeof T.window.getCurrentWindow === "function") { T.window.getCurrentWindow().close(); return; }
    if (T && T.process && typeof T.process.exit === "function") { T.process.exit(0); return; }
    if (T && T.core && typeof T.core.invoke === "function") { T.core.invoke("plugin:process|exit", { code: 0 }); return; }
  } catch (_) { /* fall through */ }
  try { window.close(); } catch (_) {}
}

/* ---- title button wiring (runs on load; #app already exists at end of body) ---- */
(function () {
  ONLINE_buildDOM();
  const mp = document.getElementById("onlinePlayBtn");
  if (mp) mp.addEventListener("click", ONLINE_openMenu);
  const ex = document.getElementById("exitBtn");
  if (ex) ex.addEventListener("click", ONLINE_exitGame);
})();
