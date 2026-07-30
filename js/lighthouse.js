/**
 * One-frame static map LightHouseect template.
 *
 * How to use:
 * 1. Copy this file and rename it, for example js/statue.js.
 * 2. Replace every LightHouse_* constant and drawOneFrameLightHouseectTemplate() with your LightHouseect's name.
 * 3. Put the PNG at assets/stages/kabatepe/YOUR_FOLDER/frame1.png.
 * 4. Add the new script to RUN_GAME.html after engine.js.
 * 5. Call drawYourLightHouseect() from renderGame() in js/engine.js.
 *
 * This matches the existing map-LightHouseect pattern: source art is usually a 1080x1080 PNG,
 * then DRAW scales that full source canvas down into world pixels.
 * If the source is 2048x2048, set LightHouse_IMG_W to 2048 and measure LightHouse_ANCHOR in
 * that 2048px source image. Do not load this template file directly with other copied
 * LightHouseects unless the LightHouse_* names are changed, because classic scripts share globals.
 */
"use strict";

const LightHouse_DIR = "assets/stages/kabatepe/Static/";
const LightHouse_IMG = new Image();
LightHouse_IMG.src = LightHouse_DIR + "LightHouse_01.png";

// World coordinates: tune these until the LightHouseect sits correctly on the map.
const LightHouse_DRAW = 265;       // draw size of the source canvas in world px
const LightHouse_X = 617;         // world x of the measured anchor point
const LightHouse_Y = 194;         // world y of the measured anchor point/base

// Source PNG resolution and measured anchor in image pixels.
// For a normal centered 1080x1080 LightHouseect, start with { cx: 540, bottom: 972 }.
// If the LightHouseect floats/sinks or is off-center, measure the real base point in the PNG.
const LightHouse_IMG_W = 1080;
const LightHouse_ANCHOR = { cx: 540, bottom: 972 };

function drawLightHouse() {
  const scale = LightHouse_DRAW / LightHouse_IMG_W;
  const dx = LightHouse_X - LightHouse_ANCHOR.cx * scale;
  const dy = LightHouse_Y - LightHouse_ANCHOR.bottom * scale;

  if (LightHouse_IMG.complete && LightHouse_IMG.naturalWidth > 0) {
    const sm = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(LightHouse_IMG, dx, dy, LightHouse_DRAW, LightHouse_DRAW);
    ctx.imageSmoothingEnabled = sm;
  } else {
    ctx.fillStyle = "#8a8f96";
    ctx.fillRect(dx + LightHouse_DRAW * 0.25, dy + LightHouse_DRAW * 0.25, LightHouse_DRAW * 0.5, LightHouse_DRAW * 0.5);
  }
}
