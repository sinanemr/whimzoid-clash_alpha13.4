/**
 * One-frame static map Carect template.
 *
 * How to use:
 * 1. Copy this file and rename it, for example js/statue.js.
 * 2. Replace every Car_* constant and drawOneFrameCarectTemplate() with your Carect's name.
 * 3. Put the PNG at assets/stages/kabatepe/YOUR_FOLDER/frame1.png.
 * 4. Add the new script to RUN_GAME.html after engine.js.
 * 5. Call drawYourCarect() from renderGame() in js/engine.js.
 *
 * This matches the existing map-Carect pattern: source art is usually a 1080x1080 PNG,
 * then DRAW scales that full source canvas down into world pixels.
 * If the source is 2048x2048, set Car_IMG_W to 2048 and measure Car_ANCHOR in
 * that 2048px source image. Do not load this template file directly with other copied
 * Carects unless the Car_* names are changed, because classic scripts share globals.
 */
"use strict";

const Car_DIR = "assets/stages/kabatepe/Static/Car/";
const Car_IMG = new Image();
Car_IMG.src = Car_DIR + "Car_side.png";

// World coordinates: tune these until the Carect sits correctly on the map.
const Car_DRAW = 64;       // draw size of the source canvas in world px
const Car_X = 900;         // world x of the measured anchor point
const Car_Y = 230;         // world y of the measured anchor point/base

// Source PNG resolution and measured anchor in image pixels.
// For a normal centered 1080x1080 Carect, start with { cx: 540, bottom: 972 }.
// If the Carect floats/sinks or is off-center, measure the real base point in the PNG.
const Car_IMG_W = 1080;
const Car_ANCHOR = { cx: 540, bottom: 972 };

function drawCar() {
  const scale = Car_DRAW / Car_IMG_W;
  const dx = Car_X - Car_ANCHOR.cx * scale;
  const dy = Car_Y - Car_ANCHOR.bottom * scale;

  if (Car_IMG.complete && Car_IMG.naturalWidth > 0) {
    const sm = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(Car_IMG, dx, dy, Car_DRAW, Car_DRAW);
    ctx.imageSmoothingEnabled = sm;
  } else {
    ctx.fillStyle = "#8a8f96";
    ctx.fillRect(dx + Car_DRAW * 0.25, dy + Car_DRAW * 0.25, Car_DRAW * 0.5, Car_DRAW * 0.5);
  }
}
