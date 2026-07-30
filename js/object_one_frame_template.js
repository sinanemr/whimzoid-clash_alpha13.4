/**
 * One-frame static map object template.
 *
 * How to use:
 * 1. Copy this file and rename it, for example js/statue.js.
 * 2. Replace every OBJ_* constant and drawOneFrameObjectTemplate() with your object's name.
 * 3. Put the PNG at assets/stages/kabatepe/YOUR_FOLDER/frame1.png.
 * 4. Add the new script to RUN_GAME.html after engine.js.
 * 5. Call drawYourObject() from renderGame() in js/engine.js.
 *
 * This matches the existing map-object pattern: source art is usually a 1080x1080 PNG,
 * then DRAW scales that full source canvas down into world pixels.
 * If the source is 2048x2048, set OBJ_IMG_W to 2048 and measure OBJ_ANCHOR in
 * that 2048px source image. Do not load this template file directly with other copied
 * objects unless the OBJ_* names are changed, because classic scripts share globals.
 */
"use strict";

const OBJ_DIR = "assets/stages/kabatepe/YOUR_FOLDER/";
const OBJ_IMG = new Image();
OBJ_IMG.src = OBJ_DIR + "frame1.png";

// World coordinates: tune these until the object sits correctly on the map.
const OBJ_DRAW = 64;       // draw size of the source canvas in world px
const OBJ_X = 900;         // world x of the measured anchor point
const OBJ_Y = 220;         // world y of the measured anchor point/base

// Source PNG resolution and measured anchor in image pixels.
// For a normal centered 1080x1080 object, start with { cx: 540, bottom: 972 }.
// If the object floats/sinks or is off-center, measure the real base point in the PNG.
const OBJ_IMG_W = 1080;
const OBJ_ANCHOR = { cx: 540, bottom: 972 };

function drawOneFrameObjectTemplate() {
  const scale = OBJ_DRAW / OBJ_IMG_W;
  const dx = OBJ_X - OBJ_ANCHOR.cx * scale;
  const dy = OBJ_Y - OBJ_ANCHOR.bottom * scale;

  if (OBJ_IMG.complete && OBJ_IMG.naturalWidth > 0) {
    const sm = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(OBJ_IMG, dx, dy, OBJ_DRAW, OBJ_DRAW);
    ctx.imageSmoothingEnabled = sm;
  } else {
    ctx.fillStyle = "#8a8f96";
    ctx.fillRect(dx + OBJ_DRAW * 0.25, dy + OBJ_DRAW * 0.25, OBJ_DRAW * 0.5, OBJ_DRAW * 0.5);
  }
}
