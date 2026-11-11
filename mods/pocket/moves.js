// Pocket: each Pokémon's moves, for the field (right-click a Pokémon there:
// role "fight", then the field plays the move). Names only, made up here from
// each one's Gen 1 types; nothing is downloaded.
//
// Four moves each: weakest first. How many are usable grows with evolution:
// 1 + its stage in its line (0 base, 1 middle, 2 final) + 1 when shiny, at
// most 4. So a Bulbasaur has 1, an Ivysaur 2, a Venusaur 3, a shiny Venusaur 4.
// The locked ones still show (greyed), so you see what evolving brings.
//
// Casting: shared "pocket.fx" = { address, name, type, tier, at } (the newest
// one); the field watches it and draws the effect over that Pokémon.
import { shared, setShared } from "herdr";
import { monOf, shinyOf, stageOf } from "./mons.js";
import { isEn } from "./kit.js";

// Gen 1 types per dex (1..151), two letters at most: primary then secondary.
// N normal, F fire, W water, G grass, E electric, I ice, T fighting, P poison,
// D ground, L flying, S psychic, B bug, R rock, H ghost, X dragon.
const TYPES = (
  "GP GP GP F F FL W W W B B BL BP BP BP NL NL NL N N NL NL P P E E D D P P " + // 1-30
  "PD P P PD N N F F N N PL PL GP GP GP BG BG BP BP D D N N W W T T F F W " + // 31-60
  "W WT S S S T T T GP GP GP WP WP RD RD RD F F WS WS E E NL NL NL W WI P P W " + // 61-90
  "WI HP HP HP RD S S W W E E GS GS D D T T N P P DR DR N G N W W W W W " + // 91-120
  "WS S BL IS E F B N W WL WI N N W E F N RW RW RW RW RL N IL EL FL X X XL S S" // 121-151
).split(" ");

// Each type's moves, weakest to strongest.
const POOL = {
  N: ["TACKLE", "QUICK ATTACK", "BODY SLAM", "HYPER BEAM"],
  F: ["EMBER", "FIRE SPIN", "FLAMETHROWER", "FIRE BLAST"],
  W: ["BUBBLE", "WATER GUN", "SURF", "HYDRO PUMP"],
  G: ["VINE WHIP", "RAZOR LEAF", "PETAL DANCE", "SOLARBEAM"],
  E: ["THUNDERSHOCK", "SPARK", "THUNDERBOLT", "THUNDER"],
  I: ["POWDER SNOW", "AURORA BEAM", "ICE BEAM", "BLIZZARD"],
  T: ["KARATE CHOP", "LOW KICK", "SUBMISSION", "DYNAMICPUNCH"],
  P: ["POISON STING", "ACID", "SLUDGE", "SLUDGE BOMB"],
  D: ["SAND-ATTACK", "MUD-SLAP", "DIG", "EARTHQUAKE"],
  L: ["GUST", "WING ATTACK", "DRILL PECK", "SKY ATTACK"],
  S: ["CONFUSION", "PSYBEAM", "PSYCHIC", "FUTURE SIGHT"],
  B: ["STRING SHOT", "LEECH LIFE", "PIN MISSILE", "MEGAHORN"],
  R: ["ROCK THROW", "ROLLOUT", "ROCK SLIDE", "ANCIENTPOWER"],
  H: ["LICK", "NIGHT SHADE", "CONFUSE RAY", "SHADOW BALL"],
  X: ["TWISTER", "DRAGON RAGE", "DRAGONBREATH", "OUTRAGE"],
};
export const TYPE_NAME = {
  N: "THƯỜNG", F: "LỬA", W: "NƯỚC", G: "CỎ", E: "ĐIỆN", I: "BĂNG", T: "GIÁC ĐẤU", P: "ĐỘC",
  D: "ĐẤT", L: "BAY", S: "SIÊU LINH", B: "BỌ", R: "ĐÁ", H: "MA", X: "RỒNG",
};
export const TYPE_NAME_EN = {
  N: "NORMAL", F: "FIRE", W: "WATER", G: "GRASS", E: "ELECTRIC", I: "ICE", T: "FIGHTING", P: "POISON",
  D: "GROUND", L: "FLYING", S: "PSYCHIC", B: "BUG", R: "ROCK", H: "GHOST", X: "DRAGON",
};
export function typeName(t) {
  return (isEn() ? TYPE_NAME_EN[t] : TYPE_NAME[t]) ?? t;
}

// The ones known for a move of their own: [name, type] in order; null keeps
// the type's move in that slot.
const SIGNATURE = {
  6: [null, ["WING ATTACK", "L"], null, null],
  25: [null, ["QUICK ATTACK", "N"], null, null],
  26: [null, ["QUICK ATTACK", "N"], null, null],
  39: [["SING", "N"], ["POUND", "N"], ["DOUBLESLAP", "N"], ["BODY SLAM", "N"]],
  40: [["SING", "N"], ["POUND", "N"], ["DOUBLESLAP", "N"], ["BODY SLAM", "N"]],
  52: [["SCRATCH", "N"], ["BITE", "N"], ["PAY DAY", "N"], ["SLASH", "N"]],
  53: [["SCRATCH", "N"], ["BITE", "N"], ["PAY DAY", "N"], ["SLASH", "N"]],
  54: [null, ["CONFUSION", "S"], null, null],
  55: [null, ["CONFUSION", "S"], null, null],
  63: [["TELEPORT", "S"], null, null, null],
  94: [null, null, null, ["DREAM EATER", "S"]],
  113: [["POUND", "N"], ["SOFTBOILED", "N"], ["EGG BOMB", "N"], ["DOUBLE-EDGE", "N"]],
  129: [["SPLASH", "W"], ["TACKLE", "N"], ["FLAIL", "N"], ["SPLASH", "W"]],
  130: [["BITE", "N"], ["DRAGON RAGE", "X"], ["HYDRO PUMP", "W"], ["HYPER BEAM", "N"]],
  132: [["TRANSFORM", "N"], ["TRANSFORM", "N"], ["TRANSFORM", "N"], ["TRANSFORM", "N"]],
  133: [["TACKLE", "N"], ["SAND-ATTACK", "D"], ["QUICK ATTACK", "N"], ["TAKE DOWN", "N"]],
  143: [["REST", "N"], ["SNORE", "N"], ["BODY SLAM", "N"], ["HYPER BEAM", "N"]],
  149: [null, null, null, ["HYPER BEAM", "N"]],
  150: [["CONFUSION", "S"], ["SWIFT", "N"], ["PSYCHIC", "S"], ["PSYSTRIKE", "S"]],
  151: [["POUND", "N"], ["TRANSFORM", "N"], ["PSYCHIC", "S"], ["ANCIENTPOWER", "R"]],
};

export function typesOf(dex) {
  return (TYPES[dex - 1] ?? "N").split("");
}

// The four moves of a dex: [{ name, type, tier (0..3) }]. One type: its four;
// two: 1st weak, 2nd weak, 1st strong, 2nd strong.
export function movesOfDex(dex) {
  const [a, b] = typesOf(dex);
  const base = b
    ? [[POOL[a][0], a], [POOL[b][0], b], [POOL[a][2], a], [POOL[b][3], b]]
    : POOL[a].map((n) => [n, a]);
  const sig = SIGNATURE[dex] ?? [];
  return base.map((m, i) => {
    const [name, type] = sig[i] ?? m;
    return { name, type, tier: i };
  });
}

// How many of the four a Pokémon may use (see the top).
export function unlockedOf(pane) {
  const dex = monOf(pane);
  return Math.min(4, 1 + stageOf(dex) + (shinyOf(pane) ? 1 : 0));
}

// The moves for a pane: the four, each with `locked`.
export function movesOf(pane) {
  const n = unlockedOf(pane);
  return movesOfDex(monOf(pane)).map((m, i) => ({ ...m, locked: i >= n }));
}

// Plays a move on the field (the field role draws it).
export function castMove(address, move) {
  if (!address || !move || move.locked) return;
  setShared("pocket.fx", { address, name: move.name, type: move.type, tier: move.tier, at: Date.now() });
}
export function lastCast() {
  return shared("pocket.fx") ?? null;
}
