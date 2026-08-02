/**
 * What Just Hit Me — online session state, serialization, snapshots, interpolation.
 * Plain <script>, loaded AFTER engine + characters + settings, BEFORE network-client
 * and online-ui. Uses the shared global scope to read/write engine state
 * (fighters, projectiles, camX, timer, …). Networking transport lives in
 * network-client.js; online DOM lives in online-ui.js.
 *
 * MODEL: the HOST browser runs the authoritative simulation. The GUEST forwards
 * semantic inputs and renders interpolated snapshots. This is NOT rollback netcode.
 */
"use strict";

/* ---------------- tunables ---------------- */
const ONLINE_SNAPSHOT_RATE = 20;                 // host snapshots per second
const ONLINE_SNAPSHOT_MS = 1000 / ONLINE_SNAPSHOT_RATE;
const ONLINE_HEARTBEAT_MS = 300;                 // guest resends full held-input map this often
const ONLINE_INTERP_MIN = 20, ONLINE_INTERP_MAX = 200; // clamp measured snapshot interval (ms)

// Semantic actions (never raw key names) sent over the wire.
const ONLINE_ACTIONS = ["left", "right", "jump", "block", "crouch", "attack", "ability1", "ability2", "ability3", "ultimate"];
// Actions safe to re-assert via heartbeat (continuous holds). One-shots (attack,
// abilities) are transition-only so a heartbeat never re-fires them.
const ONLINE_HELD_ACTIONS = ["left", "right", "jump", "block", "crouch", "ultimate"];

/* ---------------- session object ---------------- */
const ONLINE = {
  mode: "offline",          // offline | connecting | lobby-host | lobby-guest | match-host | match-guest | disconnected
  socket: null,
  connected: false,
  roomCode: null,
  role: null,               // "host" | "guest"
  localPlayerIndex: null,   // 0 host, 1 guest
  opponentConnected: false,
  lobbyState: null,
  matchId: 0,
  ping: null,
  lastServerMsg: 0,

  // remote (guest -> host) input, applied to the host's Player 2 ("remote" fighter)
  remoteHeld: {},
  lastInputSeq: -1,

  // guest -> host outgoing input bookkeeping
  inputSequence: 0,
  localPrevActions: {},
  lastHeartbeat: 0,

  // guest snapshot buffer for interpolation
  prevSnap: null,
  targetSnap: null,
  lastArrival: 0,
  snapInterval: ONLINE_SNAPSHOT_MS,

  // client-side prediction of THIS player's own fighter (guest only)
  predictLocal: true,       // dev flag: false = pure snapshot (legacy) behaviour
  localFighterIndex: 1,     // which fighters[] index this client controls (guest = 1)
  localActions: {},         // current semantic held actions (for prediction)
  predPrevActions: {},      // previous frame's actions (jump-press edge detection)
  lastPredReconcileSeq: -1, // snapshot seq we last gross-error-corrected against
  predAttackT: 0,           // seconds left on a locally-predicted basic-attack animation

  // host snapshot pacing + diagnostics
  lastSnapshotSent: 0,
  snapshotSequence: 0,
  diag: { bytesSent: 0, bytesRecv: 0, lastSnapshotAge: 0, snapRate: 0, _snapCount: 0, _snapWindow: 0 }
};

function ONLINE_reset() {
  ONLINE.mode = "offline"; ONLINE.roomCode = null; ONLINE.role = null;
  ONLINE.localPlayerIndex = null; ONLINE.opponentConnected = false;
  ONLINE.lobbyState = null; ONLINE.matchId = 0;
  ONLINE.remoteHeld = {}; ONLINE.lastInputSeq = -1;
  ONLINE.inputSequence = 0; ONLINE.localPrevActions = {};
  ONLINE.prevSnap = null; ONLINE.targetSnap = null;
}

function ONLINE_isMatch() { return ONLINE.mode === "match-host" || ONLINE.mode === "match-guest"; }
function ONLINE_isHost() { return ONLINE.role === "host"; }

/* Clear every remote-held action (call on disconnect / unhealthy socket so the
   opponent's fighter never stays stuck moving). */
function ONLINE_clearRemoteInput() {
  for (const a of ONLINE_ACTIONS) ONLINE.remoteHeld[a] = false;
}

/* =====================================================================
 * SESSION EPOCH — session/match/round ids so stale delayed callbacks on the
 * host can't affect a later online round or rematch. onlineSessionId /
 * onlineMatchId / onlineRoundId are engine globals; we bump the session here.
 * ===================================================================== */
function ONLINE_newSession() {
  if (typeof onlineSessionId !== "undefined") onlineSessionId++;
}

/* =====================================================================
 * GUEST -> HOST INPUT
 * ===================================================================== */
/* Read this browser's local Player-1 controls into a semantic held-action map.
   Both online players use their own activeSettings.controls.p1 profile. */
function ONLINE_readLocalActions() {
  const K = P1KEYS; // reflects activeSettings.controls.p1 on this machine
  return {
    left: !!keys[K.left], right: !!keys[K.right], jump: !!keys[K.jump],
    block: !!keys[K.block], crouch: !!keys[K.crouch], attack: !!keys[K.atk],
    ability1: !!keys[K.ab[0]], ability2: !!keys[K.ab[1]], ability3: !!keys[K.ab[2]],
    ultimate: !!keys[K.ult]
  };
}

/* Guest: diff local actions vs last frame, send transitions; heartbeat periodically. */
function ONLINE_pollGuestInput(nowMs) {
  const cur = ONLINE_readLocalActions();
  ONLINE.localActions = cur;          // used by client-side movement prediction
  const prev = ONLINE.localPrevActions;
  for (const a of ONLINE_ACTIONS) {
    if (cur[a] !== !!prev[a]) {
      ONLINE.inputSequence++;
      NET_send({ type: "input", action: a, down: cur[a], sequence: ONLINE.inputSequence, clientTime: nowMs });
    }
  }
  ONLINE.localPrevActions = cur;
  if (nowMs - ONLINE.lastHeartbeat >= ONLINE_HEARTBEAT_MS) {
    ONLINE.lastHeartbeat = nowMs;
    ONLINE.inputSequence++;
    NET_send({ type: "input_state", held: cur, sequence: ONLINE.inputSequence });
  }
}

/* Guest: after focus loss, release everything both locally and on the host. */
function ONLINE_sendNeutralInput() {
  const neutral = {};
  for (const a of ONLINE_ACTIONS) neutral[a] = false;
  ONLINE.localPrevActions = neutral;
  ONLINE.inputSequence++;
  if (typeof NET_send === "function") NET_send({ type: "input_state", held: neutral, sequence: ONLINE.inputSequence });
}

/* Host: apply a single guest input transition (ordered; ignore stale sequence). */
function ONLINE_applyRemoteInput(action, down, seq) {
  if (typeof seq === "number") {
    if (seq <= ONLINE.lastInputSeq) return;   // stale/duplicate
    ONLINE.lastInputSeq = seq;
  }
  if (ONLINE_ACTIONS.indexOf(action) < 0) return;
  ONLINE.remoteHeld[action] = !!down;
}

/* Host: apply a guest heartbeat (continuous holds only). */
function ONLINE_applyRemoteState(held) {
  if (!held) return;
  for (const a of ONLINE_HELD_ACTIONS) ONLINE.remoteHeld[a] = held[a] === true;
}

/* =====================================================================
 * SERIALIZATION (host -> guest)
 * Explicit primitive-copy serialization. We never serialize functions, DOM,
 * images, canvas contexts, character-definition functions, or circular refs.
 * References (owner / seizedBy / target) are stored as fighter INDEXES.
 * ===================================================================== */
const FIGHTER_SKIP = new Set(["d", "seizedBy", "discPend"]); // d = char def (functions/images); refs handled separately

function isPrimitive(v) { const t = typeof v; return v === null || t === "number" || t === "boolean" || t === "string"; }

function serializeOnlineFighter(f) {
  const o = { cid: f.d.id };
  for (const k of Object.keys(f)) {
    if (FIGHTER_SKIP.has(k)) continue;
    const v = f[k];
    if (isPrimitive(v)) o[k] = v;
    else if (Array.isArray(v) && v.every(isPrimitive)) o[k] = v.slice();
    // objects (other than handled refs) are intentionally dropped
  }
  o.seizedByIdx = f.seizedBy ? fighters.indexOf(f.seizedBy) : -1;
  return o;
}

function serializeOnlineProjectile(p) {
  const o = {};
  for (const k of Object.keys(p)) {
    if (k === "owner" || k === "target") continue;
    const v = p[k];
    if (isPrimitive(v)) o[k] = v;
    else if (Array.isArray(v) && v.every(isPrimitive)) o[k] = v.slice();
  }
  o.ownerIdx = p.owner ? fighters.indexOf(p.owner) : -1;
  if (p.target) o.targetIdx = fighters.indexOf(p.target);
  return o;
}

function serializePlainList(arr) {
  const out = [];
  for (const item of arr) {
    const o = {};
    for (const k of Object.keys(item)) {
      const v = item[k];
      if (k === "owner" || k === "target") { o[k + "Idx"] = v ? fighters.indexOf(v) : -1; continue; }
      if (isPrimitive(v)) o[k] = v;
      else if (Array.isArray(v) && v.every(isPrimitive)) o[k] = v.slice();
    }
    out.push(o);
  }
  return out;
}

/* Build the authoritative gameplay snapshot. Gameplay state only — never pixels
   or the stage background (both browsers already have the assets). */
function serializeOnlineGameState() {
  ONLINE.snapshotSequence++;
  return {
    type: "snapshot",
    seq: ONLINE.snapshotSequence,
    hostTime: performance.now(),
    matchId: ONLINE.matchId,
    running: running,
    roundOver: roundOver,
    roundNum: roundNum,
    timer: Number.isFinite(timer) ? timer : "inf",
    stageId: stageId,
    camX: camX,
    camScale: camScale,
    tGlobal: tGlobal,
    shake: shake,
    dog: (typeof dogSerialize === "function") ? dogSerialize() : null,
    toilet: (typeof toiletSerialize === "function") ? toiletSerialize() : null,
    cars: (typeof carsSerialize === "function") ? carsSerialize() : null,
    fighters: fighters.map(serializeOnlineFighter),
    projectiles: projectiles.map(serializeOnlineProjectile),
    plats: serializePlainList(plats),
    props: serializePlainList(props),
    // small readability arrays (host-synced); decorative particles + Codex swirl stay local-only on the host
    // (their gameplay results reach the guest through synced fighter fields)
    floaters: floaters.slice(0, 24).map(fl => ({ x: fl.x, y: fl.y, txt: fl.txt, t: fl.t, col: fl.col, size: fl.size })),
    rings: rings.slice(0, 24).map(r => ({ x: r.x, y: r.y, r: r.r, max: r.max, col: r.col }))
  };
}

/* =====================================================================
 * HOST: snapshot pacing
 * ===================================================================== */
function ONLINE_hostMaybeSnapshot(nowMs) {
  if (ONLINE.mode !== "match-host") return;
  if (nowMs - ONLINE.lastSnapshotSent < ONLINE_SNAPSHOT_MS) return;
  ONLINE.lastSnapshotSent = nowMs;
  const snap = serializeOnlineGameState();
  NET_send(snap);
}

/* =====================================================================
 * GUEST: apply snapshots + interpolate
 * ===================================================================== */
// Movement/pose fields the guest PREDICTS for its own fighter (so they aren't
// overwritten by the delayed authoritative snapshot while the player is free-moving).
const ONLINE_PRED_FIELDS = new Set(["x", "y", "vx", "vy", "facing", "state", "t", "onGround", "jumps", "blocking", "crouching"]);

function applyOnlineFighterFields(f, o, skip) {
  for (const k of Object.keys(o)) {
    if (k === "cid" || k === "seizedByIdx") continue;
    if (skip && skip.has(k)) continue;          // predicted fields: keep local value
    f[k] = o[k];
  }
  f.seizedBy = (o.seizedByIdx >= 0 && fighters[o.seizedByIdx]) ? fighters[o.seizedByIdx] : null;
}

/* Rebuild plain gameplay object lists on the guest, restoring index refs. */
function rebuildFromPlainList(arr) {
  const out = [];
  for (const o of arr) {
    const item = {};
    for (const k of Object.keys(o)) {
      if (k === "ownerIdx") { item.owner = o.ownerIdx >= 0 ? fighters[o.ownerIdx] : null; continue; }
      if (k === "targetIdx") { item.target = o.targetIdx >= 0 ? fighters[o.targetIdx] : null; continue; }
      item[k] = o[k];
    }
    out.push(item);
  }
  return out;
}

/* Called when a fresh authoritative snapshot arrives on the guest. */
function ONLINE_receiveSnapshot(snap) {
  if (ONLINE.mode !== "match-guest") return;
  if (ONLINE.targetSnap && snap.seq <= ONLINE.targetSnap.seq) return; // stale/out-of-order
  const now = performance.now();
  if (ONLINE.targetSnap) {
    ONLINE.snapInterval = Math.max(ONLINE_INTERP_MIN, Math.min(ONLINE_INTERP_MAX, now - ONLINE.lastArrival));
  }
  ONLINE.prevSnap = ONLINE.targetSnap;
  ONLINE.targetSnap = snap;
  ONLINE.lastArrival = now;
  ONLINE.diag.lastSnapshotAge = 0;
}

const lerp = (a, b, t) => a + (b - a) * t;

/* Is this client's own fighter currently free to move under local control (so we may
   predict it), or is it host-controlled — attacking, stunned, grabbed, flying, dead,
   between rounds — and must follow the authoritative snapshot instead? */
function ONLINE_ownFree(to) {
  return !!to.alive && !roundOver
    && (to.stun || 0) <= 0 && (to.frozen || 0) <= 0
    && to.state !== "attack" && to.state !== "special"
    && !(to.seizedByIdx >= 0) && !to.flying;
}

/* Advance the guest's own fighter one frame from LOCAL input, mirroring the engine's
   movement math (readInput/updateFighter) so it stays close to the host's result.
   Movement/pose only — damage, hits, cooldowns and status remain host-authoritative. */
function ONLINE_predictLocalMovement(f, dt) {
  const a = ONLINE.localActions || {};
  const p = ONLINE.predPrevActions || {};
  // --- predicted basic-attack animation: show the swing instantly. The actual hit,
  //     damage and knockback stay host-authoritative and arrive via snapshot. ---
  if (ONLINE.predAttackT > 0) {
    ONLINE.predAttackT -= dt;
    f.state = "attack"; f.vx = 0; f.t = (f.t || 0) + dt;
    if (!f.onGround) { f.vy += GRAV * dt; f.y += f.vy * dt; if (f.y >= GROUND) { f.y = GROUND; f.vy = 0; f.onGround = true; f.jumps = 0; } }
    ONLINE.predPrevActions = Object.assign({}, a);
    return;
  }
  if (!!a.attack && !p.attack && !f.disarm && f.state !== "attack" && f.state !== "special") {
    ONLINE.predAttackT = 0.28;   // brief anim window; host's real attack takes over when its snapshot arrives
    f.state = "attack"; f.vx = 0; f.t = 0;
    ONLINE.predPrevActions = Object.assign({}, a);
    return;
  }
  const jumpPressed = !!a.jump && !p.jump;
  let mv = (a.left ? -1 : 0) + (a.right ? 1 : 0);
  if (f.confuse > 0) mv = -mv;
  const blocking = !!a.block && f.onGround;
  const crouching = !!a.crouch && f.onGround && !blocking;
  f.blocking = blocking;
  f.crouching = crouching;
  if (blocking || crouching) {
    f.vx = 0;
    if (f.onGround) f.state = "idle";
  } else {
    f.vx = mv * f.d.speed * (f.spdBuff > 0 ? 1.6 : 1) * (f.slowT > 0 ? (1 - (f.slowAmt || 0)) : 1) * (f.frenzy > 0 ? 1.1 : 1);
    if (mv !== 0) f.facing = mv > 0 ? 1 : -1;
    const dbl = (f.d.id === "necaati" || f.d.id === "satori" || f.d.id === "agron");
    if (jumpPressed && f.onGround) { f.vy = -f.d.jump; f.onGround = false; f.jumps = 1; }
    else if (jumpPressed && dbl && f.jumps < 2) { f.vy = -f.d.jump * 0.85; f.jumps = 2; }
  }
  // integrate — matches engine: horizontal always, gravity only while airborne
  f.x += f.vx * dt;
  if (!f.onGround) {
    f.vy += GRAV * dt; f.y += f.vy * dt;
    if (f.y >= GROUND) { f.y = GROUND; f.vy = 0; f.onGround = true; f.jumps = 0; }
  }
  if (f.x < WALL_L) f.x = WALL_L;
  if (f.x > WALL_R) f.x = WALL_R;
  if (typeof CARS_WALL_X !== "undefined" && f.x < CARS_WALL_X) f.x = CARS_WALL_X;   // front cars = left map limit
  if (typeof TOILET_WALL !== "undefined") {   // right-side toilet wall (shifts left once the door opens)
    const tw = (typeof toilet !== "undefined" && toilet.open && typeof TOILET_WALL_OPEN !== "undefined") ? TOILET_WALL_OPEN : TOILET_WALL;
    if (f.x > tw) f.x = tw;
  }
  // pose
  if (f.onGround) { if (!blocking && !crouching) f.state = (mv !== 0) ? "walk" : "idle"; }
  else f.state = "jump";
  f.t = (f.t || 0) + dt;
  ONLINE.predPrevActions = Object.assign({}, a);
}

/* Guest per-frame: apply discrete state from the target snapshot; interpolate the
   opponent between snapshots; PREDICT this player's own fighter for instant control. */
function ONLINE_guestTick(dt, nowMs) {
  ONLINE_pollGuestInput(nowMs);
  const tgt = ONLINE.targetSnap;
  if (!tgt) return;
  const prev = ONLINE.prevSnap;
  let t = 1;
  if (prev) t = Math.max(0, Math.min(1, (nowMs - ONLINE.lastArrival) / ONLINE.snapInterval));

  // discrete match state from the latest authoritative snapshot
  roundNum = tgt.roundNum;
  roundOver = tgt.roundOver;
  stageId = tgt.stageId;
  tGlobal = tgt.tGlobal;
  shake = tgt.shake;
  timer = tgt.timer === "inf" ? Infinity : tgt.timer;
  if (typeof dogApply === "function") dogApply(tgt.dog);   // roaming dog (host-authoritative)
  if (typeof toiletApply === "function") toiletApply(tgt.toilet);   // toilet event (host-authoritative)
  if (typeof carsApply === "function") carsApply(tgt.cars);   // car explosion event (host-authoritative)

  // fighters
  const localIdx = (ONLINE.localFighterIndex != null) ? ONLINE.localFighterIndex : 1;
  for (let i = 0; i < fighters.length && i < tgt.fighters.length; i++) {
    const f = fighters[i], to = tgt.fighters[i];
    if (ONLINE.predictLocal && i === localIdx && ONLINE_ownFree(to)) {
      // OWN fighter, free to move: authoritative for everything EXCEPT movement/pose,
      // which we predict locally so it responds instantly.
      applyOnlineFighterFields(f, to, ONLINE_PRED_FIELDS);
      // Once per fresh snapshot, snap on a GROSS error (registers hits, knockback,
      // wall stops, fighter-vs-fighter collisions). Small RTT lead is left alone so
      // it doesn't rubber-band during normal movement.
      if (tgt.seq !== ONLINE.lastPredReconcileSeq) {
        ONLINE.lastPredReconcileSeq = tgt.seq;
        if (Math.abs(f.x - to.x) > 70 || Math.abs(f.y - to.y) > 70) {
          f.x = to.x; f.y = to.y; f.vx = to.vx; f.vy = to.vy; f.onGround = to.onGround; f.jumps = to.jumps;
        }
      }
      ONLINE_predictLocalMovement(f, dt);
    } else {
      // opponent, or own-but-host-controlled: follow authoritative + interpolate
      if (i === localIdx) ONLINE.predAttackT = 0;   // authoritative state supersedes a predicted attack
      applyOnlineFighterFields(f, to);
      if (prev && prev.fighters[i]) {
        f.x = lerp(prev.fighters[i].x, to.x, t);
        f.y = lerp(prev.fighters[i].y, to.y, t);
      }
    }
  }

  // camera
  camScale = (tgt.camScale != null) ? tgt.camScale : 1;   // zoom is host-authoritative
  if (prev) camX = lerp(prev.camX, tgt.camX, t); else camX = tgt.camX;   // host already clamped for the zoom

  // projectiles: rebuild from target; interpolate by index when counts match
  projectiles = rebuildFromPlainList(tgt.projectiles);
  if (prev && prev.projectiles.length === tgt.projectiles.length) {
    for (let i = 0; i < projectiles.length; i++) {
      projectiles[i].x = lerp(prev.projectiles[i].x, tgt.projectiles[i].x, t);
      projectiles[i].y = lerp(prev.projectiles[i].y, tgt.projectiles[i].y, t);
    }
  }

  // discrete world objects + readability effects (from the authoritative snapshot)
  plats = rebuildFromPlainList(tgt.plats);
  props = rebuildFromPlainList(tgt.props);
  floaters = tgt.floaters.map(fl => ({ x: fl.x, y: fl.y, txt: fl.txt, t: fl.t, col: fl.col, size: fl.size }));
  rings = tgt.rings.map(r => ({ x: r.x, y: r.y, r: r.r, max: r.max, col: r.col }));
  // NOTE: the guest never calls updateFx() — that function resolves Munevver's
  // Codex (damage/stun) and ages projectiles, which are host-authoritative. The
  // Codex swirl + decorative particles are host-only visuals on the guest; the
  // gameplay results (HP/stun/etc.) arrive through the synced fighter fields.
}

/* =====================================================================
 * START / END online matches
 * ===================================================================== */
function ONLINE_charDef(id) { return CHARS.find(c => c.id === id); }

function ONLINE_beginMatch(hostChar, guestChar, rules, matchId) {
  const d1 = ONLINE_charDef(hostChar), d2 = ONLINE_charDef(guestChar);
  if (!d1 || !d2) return;
  ONLINE.matchId = matchId;
  if (typeof onlineMatchId !== "undefined") onlineMatchId = matchId;
  stageId = 0;
  // Match rules always come from the host's lobby selection.
  matchRoundTime = getRoundTimeValue(rules.roundTime);
  matchWinsRequired = rules.roundsToWin;
  ONLINE_clearRemoteInput();
  ONLINE.localPrevActions = {};
  ONLINE.localActions = {}; ONLINE.predPrevActions = {}; ONLINE.lastPredReconcileSeq = -1; ONLINE.predAttackT = 0;
  ONLINE.prevSnap = null; ONLINE.targetSnap = null;

  if (ONLINE.role === "host") {
    ONLINE.mode = "match-host";
    ONLINE.localFighterIndex = 0;   // host runs the full sim; no prediction needed
    fighters = [new Fighter(d1, SPAWN_1, 1, "p1"), new Fighter(d2, SPAWN_2, -1, "remote")];
    camX = camClamp((SPAWN_1 + SPAWN_2) / 2 - W / 2);
    roundNum = 1; running = true; paused = false;
    if (typeof ONLINE_showFightScreen === "function") ONLINE_showFightScreen();
    startRound();
    lastT = performance.now(); requestAnimationFrame(loop);
  } else {
    ONLINE.mode = "match-guest";
    ONLINE.localFighterIndex = 1;   // the guest controls (and predicts) fighters[1]
    // Guest renders both fighters; the opponent from snapshots, its own via prediction.
    fighters = [new Fighter(d1, SPAWN_1, 1, "p1"), new Fighter(d2, SPAWN_2, -1, "remote")];
    projectiles = []; particles = []; floaters = []; rings = []; codexes = []; plats = []; props = [];
    camX = camClamp((SPAWN_1 + SPAWN_2) / 2 - W / 2);
    roundNum = 1; running = true; paused = false; roundOver = false;
    if (typeof ONLINE_showFightScreen === "function") ONLINE_showFightScreen();
    lastT = performance.now(); requestAnimationFrame(loop);
  }
}

/* Host authoritative victory: stop sim, notify guest, show the online post-match UI. */
function ONLINE_hostVictory(winner) {
  running = false;
  const idx = fighters.indexOf(winner);
  NET_send({
    type: "match_event", event: "match_victory",
    winnerIndex: idx, winnerId: winner.d.id,
    winnerName: winner.d.name, wins: fighters.map(f => f.wins)
  });
  if (typeof ONLINE_showPostMatch === "function") ONLINE_showPostMatch(winner.d.name);
}

/* End the online match cleanly (disconnect / leave). */
function ONLINE_endMatchLocal() {
  running = false; paused = false;
  ONLINE.prevSnap = null; ONLINE.targetSnap = null;
  ONLINE_clearRemoteInput();
}
