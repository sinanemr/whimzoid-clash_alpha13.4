"use strict";
/**
 * What Just Hit Me — combined HTTP + WebSocket server (host-authoritative online 1v1).
 *
 * One Node process:
 *   1. Serves the static game files over HTTP (RUN_GAME.html + js/css/assets).
 *   2. Accepts WebSocket connections at /ws.
 *   3. Manages private two-player rooms (server/room-manager.js).
 *   4. Relays semantic inputs (guest -> host), authoritative snapshots (host ->
 *      guest), and lobby/match events between the two room members.
 *
 * The server never simulates gameplay and never decides outcomes — it only
 * validates message shape/authority and relays. Uses only built-in Node modules
 * plus the `ws` package.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");
const rm = require("./room-manager");

const PORT = process.env.PORT || 8080;
const ROOT = path.join(__dirname, "..");           // the game folder (one level up from server/)
const MAX_MESSAGE_BYTES = 64 * 1024;               // reject anything larger (snapshots are well under this)

// Semantic actions a guest may send. Raw keyboard keys are NEVER sent over the wire.
const ALLOWED_ACTIONS = new Set([
  "left", "right", "jump", "block", "crouch", "attack", "ability1", "ability2", "ability3", "ultimate"
]);

// Version compatibility. Clients send { type:"hello", gameVersion, protocolVersion }.
// Compatibility is gated on protocolVersion (bump only on breaking wire changes);
// gameVersion is informational (shown to the player on a mismatch).
const SERVER_PROTOCOL_VERSION = 1;
const SERVER_GAME_VERSION = "13.4";

/* =========================================================================
 * HTTP static file serving (with directory-traversal protection)
 * ========================================================================= */
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2",
  ".ttf": "font/ttf", ".map": "application/json; charset=utf-8", ".webp": "image/webp"
};

function safeResolve(urlPath) {
  // Strip query/hash, decode, and normalize; reject anything escaping ROOT.
  let p = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  if (p === "/" || p === "") p = "/RUN_GAME.html";
  const resolved = path.normalize(path.join(ROOT, p));
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) return null; // traversal blocked
  return resolved;
}

const httpServer = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "Allow": "GET, HEAD" }); res.end("Method Not Allowed"); return;
  }
  const filePath = safeResolve(req.url);
  if (!filePath) { res.writeHead(403); res.end("Forbidden"); return; }
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); res.end("Not Found"); return; }
    const type = MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Content-Length": st.size });
    if (req.method === "HEAD") { res.end(); return; }
    fs.createReadStream(filePath).on("error", () => { try { res.destroy(); } catch (_) {} }).pipe(res);
  });
});

/* =========================================================================
 * WebSocket signalling / relay
 * ========================================================================= */
const wss = new WebSocketServer({ server: httpServer, path: "/ws", maxPayload: MAX_MESSAGE_BYTES });

function send(ws, obj) {
  if (ws && ws.readyState === ws.OPEN) {
    try { ws.send(JSON.stringify(obj)); } catch (_) {}
  }
}
function sendError(ws, code) { send(ws, { type: "room_error", error: code }); }

function lobbyPayload(room) {
  return {
    type: "lobby_state",
    roomCode: room.code,
    matchActive: room.matchActive,
    hostConnected: !!room.host,
    guestConnected: !!room.guest,
    hostChar: room.lobby.hostChar,
    guestChar: room.lobby.guestChar,
    hostReady: room.lobby.hostReady,
    guestReady: room.lobby.guestReady,
    rules: room.lobby.rules
  };
}
function broadcastLobby(room) {
  const p = lobbyPayload(room);
  send(room.host, p);
  send(room.guest, p);
}

function handleMessage(ws, raw) {
  if (typeof raw !== "string") { if (raw && raw.length > MAX_MESSAGE_BYTES) return; raw = raw.toString(); }
  if (raw.length > MAX_MESSAGE_BYTES) return;
  let msg;
  try { msg = JSON.parse(raw); } catch (_) { return; }               // ignore malformed JSON
  if (!msg || typeof msg !== "object" || typeof msg.type !== "string") return;

  switch (msg.type) {
    case "hello": {
      // Version handshake. Must succeed before create/join is allowed.
      if (msg.protocolVersion !== SERVER_PROTOCOL_VERSION) {
        send(ws, {
          type: "version_mismatch",
          requiredProtocol: SERVER_PROTOCOL_VERSION, gotProtocol: msg.protocolVersion,
          serverVersion: SERVER_GAME_VERSION, clientVersion: msg.gameVersion
        });
        return;
      }
      ws._helloOk = true;
      send(ws, { type: "hello_ok", serverVersion: SERVER_GAME_VERSION, protocolVersion: SERVER_PROTOCOL_VERSION });
      return;
    }

    case "ping":
      send(ws, { type: "pong", clientTime: msg.clientTime });
      return;

    case "create_room": {
      if (!ws._helloOk) { send(ws, { type: "version_mismatch", requiredProtocol: SERVER_PROTOCOL_VERSION, serverVersion: SERVER_GAME_VERSION }); return; }
      if (ws._room) return; // already in a room
      const room = rm.createRoom(ws);
      send(ws, { type: "room_created", roomCode: room.code, role: "host", playerIndex: 0 });
      broadcastLobby(room);
      return;
    }

    case "join_room": {
      if (!ws._helloOk) { send(ws, { type: "version_mismatch", requiredProtocol: SERVER_PROTOCOL_VERSION, serverVersion: SERVER_GAME_VERSION }); return; }
      if (ws._room) return;
      const code = typeof msg.roomCode === "string" ? msg.roomCode.trim().toUpperCase() : "";
      const result = rm.joinRoom(code, ws);
      if (!result.ok) { sendError(ws, result.error); return; }
      const room = result.room;
      send(ws, { type: "room_joined", roomCode: room.code, role: "guest", playerIndex: 1 });
      broadcastLobby(room);
      return;
    }

    // ---- room-member-only messages below ----
    default: break;
  }

  const room = rm.roomOf(ws);
  if (!room) return;                       // sender is not in a room; ignore everything else
  const role = room.host === ws ? "host" : "guest";
  const other = rm.otherSocket(room, ws);

  switch (msg.type) {
    case "select_character": {
      const id = typeof msg.characterId === "string" ? msg.characterId : null;
      if (!id || !rm.isPlayableCharacter(id)) { sendError(ws, "INVALID_CHARACTER"); return; }
      if (role === "host") { room.lobby.hostChar = id; room.lobby.hostReady = false; }
      else { room.lobby.guestChar = id; room.lobby.guestReady = false; }
      broadcastLobby(room);
      return;
    }

    case "set_ready": {
      const ready = msg.ready === true;
      if (role === "host") room.lobby.hostReady = ready;
      else room.lobby.guestReady = ready;
      broadcastLobby(room);
      return;
    }

    case "set_rules": {
      // Only the host defines match rules; guest sees them read-only.
      if (role !== "host") return;
      const r = msg.rules || {};
      const rt = r.roundTime;
      room.lobby.rules = {
        roundTime: (rt === "unlimited" || [30, 60, 90].includes(+rt)) ? (rt === "unlimited" ? "unlimited" : +rt) : 60,
        roundsToWin: [1, 2, 3].includes(+r.roundsToWin) ? +r.roundsToWin : 2
      };
      broadcastLobby(room);
      return;
    }

    case "start_match": {
      if (role !== "host") return;                     // guest can never start
      const L = room.lobby;
      const bothConnected = !!room.host && !!room.guest;
      const bothReady = L.hostReady && L.guestReady;
      const validChars = rm.isPlayableCharacter(L.hostChar) && rm.isPlayableCharacter(L.guestChar);
      if (!bothConnected || !bothReady || !validChars) { sendError(ws, "FAILED_MATCH_START"); return; }
      room.matchActive = true;
      room.matchId = (room.matchId || 0) + 1;
      room.rematch = { host: null, guest: null };
      const startMsg = {
        type: "start_match",
        matchId: room.matchId,
        hostChar: L.hostChar,
        guestChar: L.guestChar,
        rules: L.rules
      };
      send(room.host, startMsg);
      send(room.guest, startMsg);
      return;
    }

    case "input": {
      // Guest -> host only. Validate semantic action + boolean + sequence.
      if (role !== "guest") return;
      if (!ALLOWED_ACTIONS.has(msg.action)) return;
      if (typeof msg.down !== "boolean") return;
      if (typeof msg.sequence !== "number") return;
      send(room.host, { type: "input", action: msg.action, down: msg.down, sequence: msg.sequence });
      return;
    }

    case "input_state": {
      // Guest -> host heartbeat: full held map (self-heals dropped key-ups).
      if (role !== "guest") return;
      if (!msg.held || typeof msg.held !== "object") return;
      const held = {};
      for (const a of ALLOWED_ACTIONS) held[a] = msg.held[a] === true;
      send(room.host, { type: "input_state", held, sequence: typeof msg.sequence === "number" ? msg.sequence : 0 });
      return;
    }

    case "snapshot": {
      // Only the host is authoritative. Relay verbatim to the guest.
      if (role !== "host") return;
      if (!room.guest) return;
      send(room.guest, msg);
      return;
    }

    case "match_event": {
      if (role !== "host") return;                     // authoritative events come from the host
      send(other, msg);
      return;
    }

    case "rematch_vote": {
      const vote = msg.vote === "rematch" ? "rematch" : (msg.vote === "character_select" ? "character_select" : null);
      if (!vote) return;
      room.rematch[role] = vote;
      // Relay the vote so the opponent can show "WAITING…" state.
      send(other, { type: "rematch_vote", from: role, vote });
      const h = room.rematch.host, g = room.rematch.guest;
      if (h && g) {
        if (h === "rematch" && g === "rematch") {
          room.matchId = (room.matchId || 0) + 1;
          room.matchActive = true;
          room.rematch = { host: null, guest: null };
          const m = { type: "match_event", event: "rematch_start", matchId: room.matchId };
          send(room.host, m); send(room.guest, m);
        } else {
          // Anyone choosing character select returns both to the lobby.
          room.matchActive = false;
          room.rematch = { host: null, guest: null };
          room.lobby.hostReady = false;
          room.lobby.guestReady = false;
          send(room.host, { type: "return_to_lobby" });
          send(room.guest, { type: "return_to_lobby" });
          broadcastLobby(room);
        }
      }
      return;
    }

    case "return_to_lobby": {
      room.matchActive = false;
      room.rematch = { host: null, guest: null };
      room.lobby.hostReady = false;
      room.lobby.guestReady = false;
      send(other, { type: "return_to_lobby" });
      broadcastLobby(room);
      return;
    }

    case "leave_room": {
      const info = rm.removeClient(ws);
      if (info.other) send(info.other, { type: info.role === "host" ? "host_disconnected" : "opponent_disconnected" });
      return;
    }

    default:
      return; // unknown type: ignore
  }
}

wss.on("connection", (ws) => {
  ws._room = null;
  ws._role = null;
  ws._helloOk = false;
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });

  ws.on("message", (data, isBinary) => {
    if (isBinary) return;                 // this protocol is JSON text only
    try { handleMessage(ws, data.toString()); }
    catch (e) { /* never crash on client data */ }
  });

  ws.on("close", () => {
    const info = rm.removeClient(ws);
    if (info.other) {
      send(info.other, { type: info.role === "host" ? "host_disconnected" : "opponent_disconnected" });
    }
  });

  ws.on("error", () => { /* swallow socket errors; close handler does cleanup */ });
});

// Detect and drop dead sockets.
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) { try { ws.terminate(); } catch (_) {} return; }
    ws.isAlive = false;
    try { ws.ping(); } catch (_) {}
  });
}, 30000);
wss.on("close", () => clearInterval(heartbeat));

httpServer.listen(PORT, () => {
  console.log(`What Just Hit Me server running at http://localhost:${PORT}`);
  console.log(`Open that URL in two browser windows (or on two devices on the same network) to play online.`);
});
