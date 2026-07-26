/**
 * Keyboard bindings. Loaded as a plain <script> (not a module) so the game runs by
 * double-clicking index.html as well as from a server.
 *
 * Player 1 uses the NEW scheme (an intentional change from 13.1).
 * Player 2 is preserved EXACTLY from 13.1.
 *
 * Every on-screen key label is generated from CONTROLS via keyLabel(), so editing
 * a binding here automatically updates the title helper, the fight-screen helper,
 * the character-select ability/ultimate labels and the HUD cooldown/ult labels.
 */
const CONTROLS = {
  p1: {
    left: "a",
    right: "d",
    jump: " ",
    block: "u",
    crouch: "s",
    attack: "i",
    abilities: ["j", "k", "l"],
    ultimate: "o"
  },

  // Preserved from 13.1 (P2KEYS). NOTE: P2's block/attack/abilities (i, k, l, o)
  // collide with the new P1 attack/abilities/ultimate — only matters in local
  // 2-player. See README for a recommended non-conflicting alternative.
  p2: {
    left: "arrowleft",
    right: "arrowright",
    jump: "arrowup",
    block: "i",
    crouch: "arrowdown",
    attack: "k",
    abilities: ["l", "o", "p"],
    ultimate: "m"
  }
};

/** Human-readable label for a raw key string (used for ALL on-screen labels). */
function keyLabel(key) {
  const labels = {
    " ": "SPACE",
    arrowleft: "←", arrowright: "→", arrowup: "↑", arrowdown: "↓",
    shift: "SHIFT", control: "CTRL", alt: "ALT",
    enter: "ENTER", escape: "ESC", tab: "TAB"
  };
  return labels[key] ?? key.toUpperCase();
}

/** Labels for a player's three ability keys, e.g. ["J","K","L"]. */
function abilityLabels(player = "p1") {
  return CONTROLS[player].abilities.map(keyLabel);
}

/** Label for a player's ultimate key, e.g. "O". */
function ultimateLabel(player = "p1") {
  return keyLabel(CONTROLS[player].ultimate);
}

/**
 * Adapter to the engine's internal key-map shape used by readInput():
 * {left,right,jump,block,crouch,atk,ab,ult}.
 */
function toEngineKeys(player) {
  const c = CONTROLS[player];
  return {
    left: c.left, right: c.right, jump: c.jump, block: c.block,
    crouch: c.crouch, atk: c.attack, ab: c.abilities.slice(), ult: c.ultimate
  };
}

/** Sanity-check bindings; logs a clear error for duplicate keys within a player. */
function validateControls() {
  for (const player of ["p1", "p2"]) {
    const c = CONTROLS[player];
    const keys = [c.left, c.right, c.jump, c.block, c.crouch, c.attack, ...c.abilities, c.ultimate];
    const seen = new Set(), dupes = new Set();
    for (const k of keys) { if (seen.has(k)) dupes.add(k); seen.add(k); }
    if (dupes.size) console.error(`[controls] ${player} has duplicate keys:`, [...dupes]);
  }
}

// Aliases the engine uses (P1KEYS/P2KEYS + on-screen labels are built from these).
const ENGINE_KEYS = toEngineKeys, ABIL_LABELS = abilityLabels, ULT_LABEL = ultimateLabel;
