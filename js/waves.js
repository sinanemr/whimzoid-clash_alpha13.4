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
const WAVE_COUNT = 80;                           // number of ripples
const WAVE_CREST = 0.34;                          // brightness of the light crest (raise/lower to taste)
const WAVE_TROUGH = 0.14;                         // darkness of the shadow trough under each crest

/* deterministic pseudo-random 0..1 from an index. */
function waveHash(n) { let h = (n * 374761393 + 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

/* World-space draw (called from renderGame, right after the backdrop). Each ripple is a
   bright crest (additive) with a dark trough just under it, so it reads on the bright water
   yet still blends into the painting. */
function drawWaves() {
  const t = tGlobal;
  ctx.save();
  for (let i = 0; i < WAVE_COUNT; i++) {
    const bx = WAVE_X_LEFT + waveHash(i * 2 + 1) * (WAVE_X_RIGHT - WAVE_X_LEFT);
    const by = WAVE_Y_TOP + waveHash(i * 7 + 3) * (WAVE_Y_BOT - WAVE_Y_TOP);
    const rate = 0.8 + waveHash(i * 5 + 2) * 1.5;
    const on = 0.5 + 0.5 * Math.sin(t * rate + waveHash(i * 3) * 6.283);   // each ripple shimmers on its own phase
    if (on < 0.3) continue;
    const str = (on - 0.3) / 0.7;                                          // 0..1 strength
    const dx = Math.sin(t * 0.6 + i * 1.3) * 3;                            // gentle horizontal drift
    const x = Math.round(bx + dx), y = Math.round(by);
    const w = Math.round(3 + waveHash(i * 11 + 4) * 6);
    const sunW = Math.max(0, 1 - Math.abs(bx - WAVE_SUN_X) / 280);         // warmth near the sun's path
    // bright crest (additive light on the water)
    ctx.globalCompositeOperation = "lighter";
    const r = Math.round(210 + 45 * sunW), g = Math.round(200 + 35 * sunW), b = Math.round(180 + 10 * sunW);
    ctx.fillStyle = "rgba(" + r + "," + g + "," + b + "," + (WAVE_CREST * str).toFixed(3) + ")";
    ctx.fillRect(x, y, w, 1);
    // dark trough just below -> gives contrast so the ripple is visible on bright water
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(38,28,52," + (WAVE_TROUGH * str).toFixed(3) + ")";
    ctx.fillRect(x + 1, y + 1, w - 1, 1);
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}
