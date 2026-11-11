// Pocket: how a move looks on the field (moves.js castMove -> the field role).
// Drawn in the Pokémon's column with plain boxes and native motion only: each
// particle is rendered at its start, then (one render later) at its end with a
// `transition`, so GPUI moves it; the Pokémon itself gets a `loop` (lunge,
// hop, shake, flicker) while the move lasts. A stronger move (tier 0..3) has
// more particles, goes farther and lasts longer; the strongest flashes the field.
import { M } from "./kit.js";

export const fxDuration = (tier) => 1100 + tier * 300;

// A seeded random, so both renders of one cast draw the same particles.
function seeded(seed) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// Palette names, read at render time so the colors follow the theme.
const TYPE_KEY = {
  N: "text", F: "peach", W: "blue", G: "green", E: "yellow", I: "sky", T: "maroon", P: "mauve",
  D: "peach", L: "text", S: "pink", B: "green", R: "overlay1", H: "mauve", X: "lavender",
};
export const TYPE_COLOR = Object.defineProperties(
  {},
  Object.fromEntries(Object.entries(TYPE_KEY).map(([k, name]) => [k, { get: () => M[name], enumerable: true }])),
);

// The parts of one cast.
//   fx: { name, type, tier, at }
//   g:  where the Pokémon is in its column: { cx (center x), mouth (y), head (y),
//       ground (y), w, h (its visible size), dir (1 right, -1 left), fieldTop (y
//       of the strip's top, relative to the column; 0) }
// Returns { parts: [{ from, to, w, h, w1?, h1?, color, round, op0, op1, delay, dur }],
//           motion: { prop, from, to, period } | null (relative to the sprite's own
//           left/top: the caller adds them), flash: bool }.
export function effectOf(fx, g) {
  const rnd = seeded(fx.at);
  const r = (lo, hi) => lo + rnd() * (hi - lo);
  const tier = Math.max(0, Math.min(3, fx.tier ?? 0));
  const n = 4 + tier * 3;
  const reach = 50 + tier * 25;
  const total = fxDuration(tier);
  const s = g.dir;
  const parts = [];
  const add = (p) => parts.push({ round: 0, op0: 1, op1: 0, delay: 0, dur: total * 0.7, ...p });
  let motion = null;
  const front = g.cx + s * (g.w / 2);

  switch (fx.type) {
    case "F": // flames out of the mouth, growing and fading
      for (let i = 0; i < n; i++) {
        const size = r(5, 9) + tier * 2;
        add({
          from: [front, g.mouth + r(-3, 3)], to: [front + s * r(reach * 0.6, reach), g.mouth + r(-18, 10)],
          w: size, h: size, w1: size * 1.8, h1: size * 1.8, round: 2,
          color: [M.peach, M.red, M.yellow][i % 3], delay: i * 55, dur: r(450, 750),
        });
      }
      motion = { prop: "left", from: 0, to: s * 3, period: 160 };
      break;
    case "W": // bubbles in a stream; strong ones raise a wave from the ground
      for (let i = 0; i < n; i++) {
        const size = r(4, 8);
        add({
          from: [front, g.mouth], to: [front + s * r(reach * 0.7, reach * 1.1), g.mouth + r(-16, 6)],
          w: size, h: size, round: size, color: i % 2 ? M.blue : M.sapphire, op1: 0.2, delay: i * 70, dur: r(500, 800),
        });
      }
      if (tier >= 2) {
        add({ from: [front, g.ground - 2], to: [front + (s > 0 ? 0 : -reach * 1.4), g.ground - 18 - tier * 4], w: 4, h: 2, w1: reach * 1.4, h1: 18 + tier * 4, color: M.sapphire, op0: 0.8, op1: 0, dur: total * 0.8, round: 3 });
      }
      break;
    case "G": // leaves flying out; SOLARBEAM: a beam
      for (let i = 0; i < n; i++) {
        add({
          from: [g.cx + r(-6, 6), g.mouth + r(-6, 6)], to: [front + s * r(reach * 0.5, reach * 1.1), g.mouth + r(-24, 14)],
          w: 6, h: 3, color: i % 2 ? M.green : M.teal, delay: i * 60, dur: r(500, 800), round: 2,
        });
      }
      if (tier === 3) add({ from: [front, g.mouth - 3], to: [s > 0 ? front : front - reach * 2, g.mouth - 3], w: 2, h: 6, w1: reach * 2, h1: 6, color: M.yellow, op0: 1, op1: 0.1, dur: total * 0.85 });
      break;
    case "E": // bolts from the sky in zigzags, the Pokémon flickers
      for (let b = 0; b < 1 + tier; b++) {
        const x = g.cx + s * r(0, reach * 0.8) + r(-8, 8);
        let y = g.fieldTop;
        const step = (g.head - y) / 3;
        for (let k = 0; k < 3; k++) {
          const dx = k % 2 ? 5 : -5;
          add({ from: [x + dx, y], to: [x + dx, y], w: 3, h: Math.max(4, step + 2), color: M.yellow, op0: 1, op1: 0, delay: b * 180, dur: 500 + tier * 80 });
          y += step;
        }
      }
      for (let i = 0; i < n; i++) {
        add({ from: [g.cx, g.mouth], to: [g.cx + r(-30, 30), g.mouth + r(-20, 12)], w: 3, h: 3, color: M.yellow, delay: i * 40, dur: 350 });
      }
      motion = { prop: "opacity", from: 0.35, to: 1, period: 180 };
      break;
    case "I": // snow falling over the front
      for (let i = 0; i < n + 3; i++) {
        const x = g.cx + s * r(0, reach * 1.1);
        add({ from: [x, g.fieldTop + r(0, 10)], to: [x + r(-10, 10), g.ground - 3], w: 3, h: 3, color: i % 2 ? M.sky : M.text, op1: 0.2, delay: i * 50, dur: r(600, 900), round: 2 });
      }
      if (tier >= 2) add({ from: [front, g.mouth - 2], to: [s > 0 ? front : front - reach * 1.6, g.mouth - 2], w: 2, h: 4, w1: reach * 1.6, h1: 4, color: M.sky, op0: 1, op1: 0, dur: total * 0.7 });
      break;
    case "T":
    case "N": // a lunge, then a star of impact in front
    default: {
      const hit = [front + s * (14 + tier * 4), g.mouth];
      add({ from: hit, to: [hit[0] - (12 + tier * 6), hit[1] - (12 + tier * 6)], w: 2, h: 2, w1: 24 + tier * 12, h1: 24 + tier * 12, round: 40, color: fx.type === "T" ? M.maroon : M.text, op0: 0.9, op1: 0, delay: 180, dur: 450 });
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const d = 14 + tier * 8;
        add({ from: hit, to: [hit[0] + Math.cos(a) * d, hit[1] + Math.sin(a) * d], w: 3, h: 3, color: M.yellow, delay: 200, dur: 400 });
      }
      motion = { prop: "left", from: 0, to: s * (8 + tier * 3), period: 300 };
      break;
    }
    case "P": // bubbles rising and spreading
      for (let i = 0; i < n; i++) {
        const size = r(4, 9);
        add({ from: [g.cx + r(-8, 8), g.mouth], to: [g.cx + r(-40, 40), g.fieldTop + r(0, 20)], w: size, h: size, round: size, color: i % 2 ? M.mauve : M.pink, op1: 0, delay: i * 60, dur: r(700, 1000) });
      }
      motion = { prop: "top", from: 0, to: 2, period: 260 };
      break;
    case "D": // dust from the ground both ways, the Pokémon shakes
      for (let i = 0; i < n + 2; i++) {
        const dir = i % 2 ? 1 : -1;
        add({ from: [g.cx, g.ground - 3], to: [g.cx + dir * r(20, reach), g.ground - r(4, 16)], w: r(4, 8), h: r(3, 6), round: 2, color: i % 3 ? M.peach : M.surface2, delay: i * 40, dur: r(500, 800) });
      }
      if (tier >= 2) add({ from: [g.cx - reach, g.ground - 1], to: [g.cx - reach, g.ground - 1], w: reach * 2, h: 3, color: M.peach, op0: 0.9, op1: 0, dur: total * 0.8 });
      motion = { prop: "left", from: -2, to: 2, period: 100 };
      break;
    case "L": // gusts in front, the Pokémon rises
      for (let i = 0; i < n; i++) {
        const y = g.mouth + r(-20, 14);
        add({ from: [front, y], to: [front + s * r(reach * 0.7, reach * 1.2), y], w: 4, h: 2, w1: 16 + tier * 4, h1: 2, color: M.text, op0: 0.9, delay: i * 60, dur: r(400, 650) });
      }
      motion = { prop: "top", from: 0, to: -(8 + tier * 3), period: 500 };
      break;
    case "S": // rings growing out of the Pokémon
      for (let i = 0; i < 2 + tier; i++) {
        const d0 = 6;
        const d1 = 50 + tier * 18;
        add({ from: [g.cx - d0 / 2, g.mouth - d0 / 2], to: [g.cx - d1 / 2, g.mouth - d1 / 2], w: d0, h: d0, w1: d1, h1: d1, round: 200, color: i % 2 ? M.pink : M.mauve, op0: 0.7, op1: 0, delay: i * 220, dur: 800, ring: true });
      }
      motion = { prop: "top", from: 0, to: -3, period: 400 };
      break;
    case "B": // pins shot forward
      for (let i = 0; i < n; i++) {
        const y = g.mouth + r(-8, 8);
        add({ from: [front, y], to: [front + s * r(reach * 0.8, reach * 1.3), y + r(-6, 6)], w: 7, h: 2, color: i % 2 ? M.green : M.yellow, op1: 0.3, delay: i * 70, dur: r(350, 550) });
      }
      break;
    case "R": // rocks falling in front
      for (let i = 0; i < n; i++) {
        const x = g.cx + s * r(20, reach * 1.1);
        const size = r(5, 9) + tier;
        add({ from: [x, g.fieldTop], to: [x, g.ground - size], w: size, h: size, round: 2, color: i % 2 ? M.overlay1 : M.surface2, op1: 1, delay: i * 90, dur: r(400, 600), easing: "ease-in" });
      }
      motion = { prop: "left", from: -1.5, to: 1.5, period: 120 };
      break;
    case "H": // shadows spreading, the Pokémon fades in and out
      for (let i = 0; i < 2 + tier; i++) {
        const d1 = 40 + tier * 16;
        add({ from: [g.cx - 4, g.mouth - 4], to: [g.cx - d1 / 2, g.mouth - d1 / 2], w: 8, h: 8, w1: d1, h1: d1, round: 200, color: i % 2 ? M.mauve : M.crust, op0: 0.8, op1: 0, delay: i * 200, dur: 900 });
      }
      motion = { prop: "opacity", from: 0.15, to: 1, period: 400 };
      break;
    case "X": // a twister: particles climbing in a swirl
      for (let i = 0; i < n + 2; i++) {
        const side = i % 2 ? 1 : -1;
        add({ from: [front + s * 20 + side * 4, g.ground - 4], to: [front + s * 20 - side * (10 + tier * 3), g.fieldTop + r(0, 12)], w: 4, h: 4, round: 2, color: i % 3 ? M.lavender : M.blue, delay: i * 60, dur: r(600, 900) });
      }
      motion = { prop: "top", from: 0, to: -4, period: 300 };
      break;
  }
  return { parts, motion, flash: tier === 3 };
}
