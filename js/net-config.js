/**
 * Whimzoid Clash — production network configuration (SINGLE SOURCE OF TRUTH).
 * Plain <script>, loaded BEFORE network-client.js / online-state.js / online-ui.js.
 *
 * This is the ONE place the client is told where the public multiplayer server is.
 * Do NOT hardcode server URLs anywhere else in the code.
 *
 * ── Installed desktop build (Tauri) ────────────────────────────────────────────
 *   The developer sets `serverUrl` to the deployed public server, e.g.
 *     serverUrl: "wss://whimzoid-clash.onrender.com/ws"
 *   The installed game then connects there automatically over secure WebSockets.
 *   Players never type or see this URL.
 *
 * ── Browser / same-origin dev (npm start, or a hosted web build) ───────────────
 *   Leave `serverUrl` as the REPLACE_… placeholder. The client then falls back to
 *   the page's own origin (ws://host/ws or wss://host/ws), so `npm start` on
 *   localhost and any same-origin web deploy keep working with no edits.
 */
"use strict";

const NETWORK_CONFIG = {
  // Set this to your deployed server for the installed desktop build.
  // Accepts "wss://host" or "wss://host/ws" (the /ws path is added if missing).
  serverUrl: "wss://whimzoid-clash-alpha13-4-1.onrender.com/ws",
  protocolVersion: 1,          // bumped only on a breaking wire-protocol change
  connectionTimeoutMs: 10000,  // how long to wait for connect + version handshake
  reconnectAttempts: 3         // connect retries before reporting failure
};

// Client build/version string, sent in the "hello" handshake for display. Actual
// compatibility is gated on protocolVersion (below), not this string.
const GAME_VERSION = "13.4";

/** True when net-config still holds the placeholder (i.e. use same-origin fallback). */
function NET_hasProductionUrl() {
  return !!NETWORK_CONFIG.serverUrl && NETWORK_CONFIG.serverUrl.indexOf("REPLACE_WITH_PRODUCTION_SERVER") < 0;
}
