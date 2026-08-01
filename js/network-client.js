/**
 * Whimzoid Clash — WebSocket transport + protocol dispatch (client side).
 * Plain <script>, loaded after online-state.js, before online-ui.js.
 *
 * Responsibilities: build the ws URL from the page location, connect, send/
 * receive framed JSON messages, measure ping, watch connection health, and
 * dispatch incoming messages to online-state (gameplay) and online-ui (screens).
 * Transport only — no gameplay decisions.
 */
"use strict";

let NET_pingTimer = null;
let NET_healthTimer = null;
let NET_unstable = false;
let NET_readyCb = null, NET_failCb = null, NET_helloOk = false, NET_attempt = 0;

function NET_isFileProtocol() { return location.protocol === "file:"; }

/**
 * Where to connect. Priority:
 *   1. NETWORK_CONFIG.serverUrl from js/net-config.js (installed desktop build).
 *   2. The page's own origin (npm start on localhost, or a same-origin web deploy).
 * The "/ws" path is appended if the configured URL doesn't already include it.
 */
function NET_wsUrl() {
  if (typeof NET_hasProductionUrl === "function" && NET_hasProductionUrl()) {
    let u = NETWORK_CONFIG.serverUrl.replace(/\/+$/, "");
    if (!/\/ws$/.test(u)) u += "/ws";
    return u;
  }
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/ws`;
}

function NET_send(obj) {
  const s = ONLINE.socket;
  if (!s || s.readyState !== WebSocket.OPEN) return false;
  try {
    const str = JSON.stringify(obj);
    ONLINE.diag.bytesSent += str.length;
    s.send(str);
    return true;
  } catch (e) { return false; }
}

/**
 * Open a connection and complete the version handshake. onReady() fires once the
 * server accepts our protocol version (hello_ok); onFail(reason) fires on timeout,
 * failure, or "VERSION_MISMATCH". Retries up to NETWORK_CONFIG.reconnectAttempts.
 * Returns false immediately (with onFail) when it can't even attempt a connection.
 */
function NET_connect(onReady, onFail) {
  // Over file:// with no production server configured, we can't connect at all.
  const hasProd = (typeof NET_hasProductionUrl === "function") && NET_hasProductionUrl();
  if (NET_isFileProtocol() && !hasProd) { if (onFail) onFail("FILE_PROTOCOL"); return false; }
  if (typeof WebSocket === "undefined") { if (onFail) onFail("UNSUPPORTED"); return false; }
  NET_readyCb = onReady || null;
  NET_failCb = onFail || null;
  NET_attempt = 0;
  NET_openSocket();
  return true;
}

/* One connection attempt (called again by NET_retryOrFail up to reconnectAttempts). */
function NET_openSocket() {
  NET_helloOk = false;
  let settled = false;
  let socket;
  try { socket = new WebSocket(NET_wsUrl()); }
  catch (e) { NET_retryOrFail("CONNECTION_FAILED"); return; }

  ONLINE.socket = socket;
  ONLINE.mode = "connecting";
  ONLINE.connected = false;
  ONLINE.lastServerMsg = performance.now();

  const timeoutMs = (typeof NETWORK_CONFIG !== "undefined" && NETWORK_CONFIG.connectionTimeoutMs) || 10000;
  const failTimer = setTimeout(() => {
    if (!settled) { settled = true; try { socket.close(); } catch (_) {} NET_retryOrFail("CONNECTION_TIMEOUT"); }
  }, timeoutMs);

  socket.onopen = () => {
    ONLINE.connected = true;
    ONLINE.lastServerMsg = performance.now();
    // Version handshake FIRST — the server replies hello_ok or version_mismatch.
    NET_send({ type: "hello", gameVersion: (typeof GAME_VERSION !== "undefined" ? GAME_VERSION : "?"), protocolVersion: NETWORK_CONFIG.protocolVersion });
  };

  socket.onmessage = (ev) => {
    ONLINE.lastServerMsg = performance.now();
    if (NET_unstable) { NET_unstable = false; if (typeof ONLINE_UI_setUnstable === "function") ONLINE_UI_setUnstable(false); }
    if (typeof ev.data !== "string") return;
    ONLINE.diag.bytesRecv += ev.data.length;
    let msg;
    try { msg = JSON.parse(ev.data); } catch (_) { return; }
    if (!msg || typeof msg.type !== "string") return;

    // Resolve the connect handshake before any general dispatch.
    if (!NET_helloOk) {
      if (msg.type === "hello_ok") {
        if (!settled) { settled = true; clearTimeout(failTimer); }
        NET_helloOk = true;
        ONLINE_newSession();
        NET_startPing(); NET_startHealthWatch();
        const cb = NET_readyCb; NET_readyCb = null; NET_failCb = null;
        if (cb) cb();
        return;
      }
      if (msg.type === "version_mismatch") {
        if (!settled) { settled = true; clearTimeout(failTimer); }
        const cb = NET_failCb; NET_readyCb = null; NET_failCb = null;
        try { socket.close(); } catch (_) {}
        if (cb) cb("VERSION_MISMATCH");
        return;
      }
      return; // ignore anything else until the handshake completes
    }
    NET_dispatch(msg);
  };

  socket.onclose = () => {
    NET_stopPing(); NET_stopHealthWatch();
    ONLINE.connected = false;
    if (!settled) { settled = true; clearTimeout(failTimer); NET_retryOrFail("CONNECTION_FAILED"); return; }
    // If we were mid-session, treat as a hard disconnect.
    if (ONLINE.mode !== "offline") {
      ONLINE_clearRemoteInput();
      if (ONLINE_isMatch()) ONLINE_endMatchLocal();
      if (typeof ONLINE_UI_onConnectionLost === "function") ONLINE_UI_onConnectionLost();
    }
  };

  socket.onerror = () => { /* onclose will follow and handle cleanup */ };
}

/* Retry the connection up to reconnectAttempts, else report the failure. */
function NET_retryOrFail(reason) {
  const maxAttempts = (typeof NETWORK_CONFIG !== "undefined" && NETWORK_CONFIG.reconnectAttempts) || 1;
  NET_attempt++;
  if (NET_attempt < maxAttempts) { setTimeout(NET_openSocket, 800); return; }
  const cb = NET_failCb; NET_readyCb = null; NET_failCb = null;
  if (cb) cb(reason);
}

function NET_close() {
  NET_stopPing(); NET_stopHealthWatch();
  const s = ONLINE.socket;
  if (s) { try { NET_send({ type: "leave_room" }); } catch (_) {} try { s.close(); } catch (_) {} }
  ONLINE.socket = null;
  ONLINE_reset();
}

/* ---------------- ping / health ---------------- */
function NET_startPing() {
  NET_stopPing();
  NET_pingTimer = setInterval(() => {
    NET_send({ type: "ping", clientTime: performance.now() });
  }, 2000);
  NET_send({ type: "ping", clientTime: performance.now() });
}
function NET_stopPing() { if (NET_pingTimer) { clearInterval(NET_pingTimer); NET_pingTimer = null; } }

function NET_startHealthWatch() {
  NET_stopHealthWatch();
  NET_healthTimer = setInterval(() => {
    const age = performance.now() - ONLINE.lastServerMsg;
    if (age > 5000 && !NET_unstable) {
      NET_unstable = true;
      if (typeof ONLINE_UI_setUnstable === "function") ONLINE_UI_setUnstable(true);
    }
  }, 1000);
}
function NET_stopHealthWatch() { if (NET_healthTimer) { clearInterval(NET_healthTimer); NET_healthTimer = null; } }

/* ---------------- incoming dispatch ---------------- */
function NET_dispatch(msg) {
  switch (msg.type) {
    case "pong":
      if (typeof msg.clientTime === "number") ONLINE.ping = Math.round(performance.now() - msg.clientTime);
      return;

    case "room_created":
      ONLINE.role = "host"; ONLINE.localPlayerIndex = 0; ONLINE.roomCode = msg.roomCode; ONLINE.mode = "lobby-host";
      if (typeof ONLINE_UI_onRoomCreated === "function") ONLINE_UI_onRoomCreated(msg);
      return;

    case "room_joined":
      ONLINE.role = "guest"; ONLINE.localPlayerIndex = 1; ONLINE.roomCode = msg.roomCode; ONLINE.mode = "lobby-guest";
      if (typeof ONLINE_UI_onRoomJoined === "function") ONLINE_UI_onRoomJoined(msg);
      return;

    case "room_error":
      if (typeof ONLINE_UI_onRoomError === "function") ONLINE_UI_onRoomError(msg.error);
      return;

    case "lobby_state":
      ONLINE.lobbyState = msg;
      ONLINE.opponentConnected = ONLINE.role === "host" ? msg.guestConnected : msg.hostConnected;
      if (typeof ONLINE_UI_onLobbyState === "function") ONLINE_UI_onLobbyState(msg);
      return;

    case "start_match":
      ONLINE_beginMatch(msg.hostChar, msg.guestChar, msg.rules, msg.matchId);
      if (typeof ONLINE_UI_onMatchStart === "function") ONLINE_UI_onMatchStart(msg);
      return;

    case "snapshot":
      ONLINE_receiveSnapshot(msg);
      return;

    case "input":
      // host applies guest input
      if (ONLINE.mode === "match-host") ONLINE_applyRemoteInput(msg.action, msg.down, msg.sequence);
      return;

    case "input_state":
      if (ONLINE.mode === "match-host") ONLINE_applyRemoteState(msg.held);
      return;

    case "match_event":
      NET_handleMatchEvent(msg);
      return;

    case "rematch_vote":
      if (typeof ONLINE_UI_onRematchVote === "function") ONLINE_UI_onRematchVote(msg);
      return;

    case "return_to_lobby":
      if (ONLINE_isMatch()) ONLINE_endMatchLocal();
      if (typeof ONLINE_UI_onReturnToLobby === "function") ONLINE_UI_onReturnToLobby();
      return;

    case "opponent_disconnected":
      ONLINE_clearRemoteInput();
      if (typeof ONLINE_UI_onOpponentDisconnected === "function") ONLINE_UI_onOpponentDisconnected();
      return;

    case "host_disconnected":
      if (ONLINE_isMatch()) ONLINE_endMatchLocal();
      if (typeof ONLINE_UI_onHostDisconnected === "function") ONLINE_UI_onHostDisconnected();
      return;

    default:
      return; // unknown message: ignore
  }
}

function NET_handleMatchEvent(msg) {
  switch (msg.event) {
    case "announce":
      // guest displays the host's round announcements
      if (typeof roundAnnounce === "function") roundAnnounce(msg.text, msg.dur || 1000);
      return;
    case "match_victory":
      running = false;
      if (typeof ONLINE_UI_onMatchVictory === "function") ONLINE_UI_onMatchVictory(msg);
      return;
    case "rematch_start":
      if (typeof ONLINE_UI_onRematchStart === "function") ONLINE_UI_onRematchStart(msg);
      return;
    default:
      return;
  }
}
