/**
 * Central game configuration — the values you are most likely to edit.
 * Every value below was verified against whimzoid-clash_alpha13.1.html.
 *
 * Loaded as a plain <script> (not an ES module) so the game runs by double-clicking
 * index.html (file://) as well as from a web server. It defines GAME_CONFIG (alias
 * CFG) and applyViewport() as globals that js/engine.js uses.
 *
 * Changing GAME_CONFIG.viewport.width cascades to the camera width, canvas logical
 * size + backing (supersampled) resolution, camera clamping, HUD width, stage crop
 * and the responsive fight-container width — no CSS edits needed.
 */
const GAME_CONFIG = {
  viewport: {
    width: 720,        // W  — visible world width (logical px); the camera window
    height: 270,       // H  — visible world height (logical px)
    renderScale: 2     // RENDER_SCALE — supersample: canvas backing = width*scale
  },
  world: {
    width: 2032,       // WORLD_W — total scrollable stage width
    ground: 249,       // GROUND  — y of the ground line (logical px)
    gravity: 1200,     // GRAV    — downward acceleration (px/s^2)
    leftWall: 652,     // WALL_L  — invisible left bound for fighters
    rightWall: 1638    // WALL_R  — invisible right bound for fighters
  },
  match: {
    roundTime: 60,     // seconds per round (timer)
    winsRequired: 2,   // round wins to take the match (best of 3)
    maximumEnergy: 100 // ult meter cap (gainMeter clamps to this)
  },
  fighters: {
    scale: 0.72,       // CH_SCALE — sprite px -> world px
    player1Spawn: 900, // SPAWN_1
    player2Spawn: 1180 // SPAWN_2
  },
  camera: {
    followSpeed: 4.5   // camX += (target-camX)*min(1, dt*followSpeed). 13.1 uses 4.5 (NOT 8).
  }
};

// Alias the engine uses throughout.
const CFG = GAME_CONFIG;

/**
 * Size the canvas to the supersampled backing resolution and publish the display
 * width as a CSS variable. The engine then draws in logical world coordinates
 * after ctx.scale(renderScale). Returns the 2D context.
 */
function applyViewport(canvas) {
  const { width, height, renderScale } = GAME_CONFIG.viewport;
  canvas.width = width * renderScale;
  canvas.height = height * renderScale;
  const root = document.documentElement.style;
  root.setProperty("--game-display-width", `${width * renderScale}px`);
  root.setProperty("--game-aspect", `${width} / ${height}`);
  return canvas.getContext("2d");
}
