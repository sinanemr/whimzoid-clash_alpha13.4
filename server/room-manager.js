"use strict";
/**
 * What Just Hit Me — in-memory room manager for private 1v1 online play.
 *
 * Responsibilities: create/join two-player rooms, track host/guest sockets and
 * lobby state, validate room membership, and clean up on disconnect. Gameplay
 * is NOT simulated here — the host browser is authoritative. This module only
 * relays and validates room/lobby/match messages.
 *
 * No database, no accounts — rooms live in memory for the lifetime of the process.
 */

// Room-code alphabet excludes visually confusable characters (0 O 1 I).
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

// Character validation (kept in sync with the roster in js/engine.js / characters/*.js).
const VALID_CHARACTER_IDS = new Set([
  "haydar", "satori", "notalk", "necaati", "necmi", "putuk", "agron", "munevver", "warbringer"
]);
const COMING_SOON_IDS = new Set(["necaati"]);

const rooms = new Map(); // code -> room

function makeCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

function uniqueCode() {
  let code, tries = 0;
  do { code = makeCode(); tries++; } while (rooms.has(code) && tries < 50);
  return code;
}

function isValidCodeFormat(code) {
  if (typeof code !== "string" || code.length !== CODE_LENGTH) return false;
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return false;
  return true;
}

function isPlayableCharacter(id) {
  return VALID_CHARACTER_IDS.has(id) && !COMING_SOON_IDS.has(id);
}

function freshLobby() {
  return {
    hostChar: null,
    guestChar: null,
    hostReady: false,
    guestReady: false,
    // Match rules come from the HOST's saved settings; guest sees them read-only.
    rules: { roundTime: 60, roundsToWin: 2 }
  };
}

/** Create a room for a host socket. Returns the room. */
function createRoom(hostWs) {
  const code = uniqueCode();
  const room = {
    code,
    host: hostWs,
    guest: null,
    createdAt: Date.now(),
    matchActive: false,
    matchId: 0,
    lobby: freshLobby(),
    rematch: { host: null, guest: null }
  };
  rooms.set(code, room);
  hostWs._room = code;
  hostWs._role = "host";
  return room;
}

/**
 * Join an existing room as guest.
 * Returns { ok:true, room } or { ok:false, error:"ROOM_NOT_FOUND"|"ROOM_FULL"|"INVALID_ROOM_CODE" }.
 */
function joinRoom(code, guestWs) {
  if (!isValidCodeFormat(code)) return { ok: false, error: "INVALID_ROOM_CODE" };
  const room = rooms.get(code);
  if (!room) return { ok: false, error: "ROOM_NOT_FOUND" };
  if (room.guest) return { ok: false, error: "ROOM_FULL" };
  room.guest = guestWs;
  guestWs._room = code;
  guestWs._role = "guest";
  return { ok: true, room };
}

function getRoom(code) { return rooms.get(code) || null; }

function roomOf(ws) {
  if (!ws || !ws._room) return null;
  return rooms.get(ws._room) || null;
}

function otherSocket(room, ws) {
  if (!room) return null;
  if (room.host === ws) return room.guest;
  if (room.guest === ws) return room.host;
  return null;
}

function deleteRoom(code) { rooms.delete(code); }

/**
 * Remove a client (on disconnect / leave). Returns
 * { room, role, other } so the caller can notify the remaining player and
 * decide cleanup. Host leaving closes the room; guest leaving frees the slot.
 */
function removeClient(ws) {
  const room = roomOf(ws);
  if (!room) return { room: null, role: null, other: null };
  const role = room.host === ws ? "host" : (room.guest === ws ? "guest" : null);
  const other = otherSocket(room, ws);
  if (role === "host") {
    // Host is authoritative — the room cannot continue without it.
    if (room.guest) { room.guest._room = null; room.guest._role = null; }
    rooms.delete(room.code);
  } else if (role === "guest") {
    room.guest = null;
    room.matchActive = false;
    room.rematch = { host: null, guest: null };
    // Reset ready state so a new guest starts clean.
    room.lobby.guestChar = null;
    room.lobby.guestReady = false;
    room.lobby.hostReady = false;
  }
  ws._room = null; ws._role = null;
  return { room, role, other };
}

function stats() {
  return { rooms: rooms.size };
}

module.exports = {
  CODE_LENGTH,
  createRoom, joinRoom, getRoom, roomOf, otherSocket, removeClient, deleteRoom,
  isValidCodeFormat, isPlayableCharacter, freshLobby, stats
};
