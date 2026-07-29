/**
 * Whimzoid Clash — subtle animated water shimmer on the Kabatepe sea. Plain <script>, loaded
 * AFTER engine.js (uses ctx, tGlobal). Pure decoration — drawn just over the backdrop (behind
 * everything else) in the open water left of the ferry. Twinkling glints, ADDITIVE-blended at
 * low opacity so they read as sunlight sparkling ON the water and blend into the painting.
 * Deterministic from tGlobal (no state) so host and guest match.
 */
"use strict";

const WAVE_X_LEFT = 340, WAVE_X_RIGHT = 780;   // open sea left of the ferry (avoid drawing over the boat)
const WAVE_Y_TOP = 112, WAVE_Y_BOT = 176;      // from the horizon down to the pier edge
const WAVE_SUN_X = 480;                          // centre of the sun's reflection (warm glints cluster here)
const WAVE_COUNT = 64;                           // number of glints

/* deterministic pseudo-random 0..1 from an index. */
function waveHash(n) { let h = (n * 374761393 + 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

/* World-space draw (called from renderGame, right after the backdrop). */
function drawWaves() {
  const t = tGlobal;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";      // add light to the water, so glints blend into the art
  for (let i = 0; i < WAVE_COUNT; i++) {
    const bx = WAVE_X_LEFT + waveHash(i * 2 + 1) * (WAVE_X_RIGHT - WAVE_X_LEFT);
    const by = WAVE_Y_TOP + waveHash(i * 7 + 3) * (WAVE_Y_BOT - WAVE_Y_TOP);
    const rate = 1.0 + waveHash(i * 5 + 2) * 1.6;
    const tw = 0.5 + 0.5 * Math.sin(t * rate + waveHash(i * 3) * 6.283);   // each glint twinkles on its own phase
    if (tw < 0.35) continue;
    const depth = (by - WAVE_Y_TOP) / (WAVE_Y_BOT - WAVE_Y_TOP);           // a touch stronger toward the front
    const alpha = (tw - 0.35) / 0.65 * (0.09 + 0.07 * depth);
    const dx = Math.sin(t * 0.7 + i * 1.3) * 2.5;                          // gentle horizontal drift
    const sunW = Math.max(0, 1 - Math.abs(bx - WAVE_SUN_X) / 260);         // warmth near the sun's path
    const r = Math.round(205 + 50 * sunW), g = Math.round(195 + 35 * sunW), b = Math.round(175 + 12 * sunW);
    ctx.fillStyle = "rgba(" + r + "," + g + "," + b + "," + alpha.toFixed(3) + ")";
    const w = 2 + waveHash(i * 11 + 4) * 5;
    ctx.fillRect(Math.round(bx + dx), Math.round(by), Math.round(w), 1);   // thin horizontal glint
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}
