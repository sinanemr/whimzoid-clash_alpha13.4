/**
 * Multi-place one-frame static map object template.
 *
 * Use this when the SAME PNG appears in several different places on the map,
 * for example crates, wood piles, rocks, barrels, signs, or dock clutter.
 *
 * How to use:
 * 1. Copy this file and rename it, for example js/crates.js.
 * 2. Replace every OBJ_* constant and drawMultiPlaceObjectTemplate() with your object's name.
 * 3. Put the PNG at assets/stages/kabatepe/YOUR_FOLDER/frame1.png.
 * 4. Add the new script to RUN_GAME.html after engine.js.
 * 5. Call drawYourObjects() from renderGame() in js/engine.js.
 *
 * This matches the existing map-object pattern: source art is usually a 1080x1080 PNG,
 * then each placement's draw value scales that full source canvas down into world pixels.
 * If the source is 2048x2048, set OBJ_IMG_W to 2048 and measure OBJ_ANCHOR in
 * that 2048px source image. Do not load this template file directly with other copied
 * objects unless the OBJ_* names are changed, because classic scripts share globals.
 */
"use strict";

const OBJ_DIR = "assets/stages/kabatepe/YOUR_FOLDER/";
const OBJ_IMG = new Image();
OBJ_IMG.src = OBJ_DIR + "frame1.png";

// Source PNG resolution and measured anchor in image pixels.
// For a normal centered 1080x1080 object, start with { cx: 540, bottom: 972 }.
const OBJ_IMG_W = 1080;
const OBJ_ANCHOR = { cx: 540, bottom: 972 };
const OBJ_DEFAULT_DRAW = 64;

// Each entry is one copy of the same object in world coordinates.
// x/y pin the measured anchor point to the map.
// draw is optional; omit it to use OBJ_DEFAULT_DRAW.
// flip is optional; set true to mirror the object horizontally.
const OBJ_PLACES = [
  { x: 360, y: 230, draw: 44 },
  { x: 760, y: 224, draw: 38 },
  { x: 1040, y: 218, draw: 32 },
  { x: 1260, y: 230, draw: 50, flip: true }
];

function drawMultiPlaceObjectTemplate() {
  for (const p of OBJ_PLACES) {
    const draw = p.draw || OBJ_DEFAULT_DRAW;
    const scale = draw / OBJ_IMG_W;
    const anchorX = p.flip ? OBJ_IMG_W - OBJ_ANCHOR.cx : OBJ_ANCHOR.cx;
    const dx = p.x - anchorX * scale;
    const dy = p.y - OBJ_ANCHOR.bottom * scale;

    if (OBJ_IMG.complete && OBJ_IMG.naturalWidth > 0) {
      const sm = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = true;
      if (p.flip) {
        ctx.save();
        ctx.translate(dx + draw, dy);
        ctx.scale(-1, 1);
        ctx.drawImage(OBJ_IMG, 0, 0, draw, draw);
        ctx.restore();
      } else {
        ctx.drawImage(OBJ_IMG, dx, dy, draw, draw);
      }
      ctx.imageSmoothingEnabled = sm;
    } else {
      ctx.fillStyle = "#8a8f96";
      ctx.fillRect(dx + draw * 0.25, dy + draw * 0.25, draw * 0.5, draw * 0.5);
    }
  }
}
