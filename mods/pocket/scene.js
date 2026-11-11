// Pocket field scenery: a Gen 2 style backdrop behind the Pokémon walk, one
// biome per town (space), in map order (this machine first, then each island):
// meadow, beach, night crag, snow peak, blossom forest, then round again.
// Each town also seeds its own layout, so two meadows never look the same.
// field.js draws it under the Pokémon: sky fill, far props, the ground line,
// near props, then the soil under the name tags. Colors are the palette's,
// pre-mixed into solids (no opacity), so pieces may overlap cleanly.
import { div, image } from "gpui-kit";
import { machines, spaces } from "herdr";
import { M, UI } from "./kit.js";

export const BIOMES = ["meadow", "beach", "crag", "snow", "blossom"];

// Spaces in map order: this machine ("") first, then other machines alphabetically.
export function townOrder() {
  const all = spaces() ?? [];
  const mk = (s) => s.machine ?? "";
  const keys = [...new Set(all.map(mk))].sort((a, b) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)));
  return keys.flatMap((k) => all.filter((s) => mk(s) === k));
}

// The shown town: its place in map order and a stable key.
export function activeTown() {
  const order = townOrder();
  const i = order.findIndex((s) => s.active);
  const s = order[i];
  return { index: Math.max(0, i), key: s ? `${s.machine ?? ""}/${s.id}` : "" };
}

export function biomeOf(town) {
  return BIOMES[town.index % BIOMES.length];
}

export const ISLANDS = ["palm", "volcano", "lighthouse", "pine", "rock"];

export function islandKind(machine) {
  if (!machine) return "home";
  const ms = (machines() ?? []).map((m) => m?.name).filter(Boolean);
  const ss = (spaces() ?? []).map((s) => s?.machine).filter(Boolean);
  const names = [...new Set([...ms, ...ss])].sort();
  const i = names.indexOf(machine);
  return ISLANDS[(i >= 0 ? i : 0) % ISLANDS.length];
}

export function islandIcon(machine, size = 10) {
  return image(`${UI}/glyphs/island-${islandKind(machine)}.svg`).size(size).flex_none();
}

// a -> b by t (0..1), both "#rrggbb".
function mix(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const x = p(a);
  const y = p(b);
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

function rng(key) {
  let s = 2166136261;
  for (const ch of String(key)) s = Math.imul(s ^ ch.charCodeAt(0), 16777619);
  s = (s >>> 0) % 2147483646 + 1;
  const next = () => (s = (s * 16807) % 2147483647) / 2147483647;
  next();
  return {
    f: next, // 0..1
    in: (lo, hi) => lo + next() * (hi - lo),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
  };
}

// Props: { x: fraction of the width, dx: px, y: px from the top (or from the
// ground line with ground: true), w, h, c, r?, rt? (rounded top), parts?
// (pieces inside, { dx, dy, w, h, c, r? }), loop? ({ prop, from, to, period },
// left/top as deltas). layer: "far" (behind the ground line) or "near".

// A pixel staircase triangle standing on `y` (ground-relative): bars of `step`
// px, widest at the bottom. cap: color of the top `capN` bars.
function peak(x, y, w, h, c, o = {}) {
  const step = o.step ?? 3;
  const n = Math.max(1, Math.round(h / step));
  const out = [];
  for (let i = 0; i < n; i++) {
    const bw = Math.max(2, Math.round(w * (1 - i / n)));
    const cap = o.cap && i >= n - (o.capN ?? 2);
    out.push({ x, dx: (o.dx ?? 0) - bw / 2, y: y - (i + 1) * step, ground: true, w: bw, h: step, c: cap ? o.cap : c, layer: o.layer ?? "far" });
  }
  return out;
}

// A dome (hill, snowdrift) standing on the ground line: a pixel half-ellipse,
// rows of `step` px.
function dome(x, w, h, c, layer = "far", step = 2) {
  const n = Math.max(1, Math.round(h / step));
  const out = [];
  for (let i = 0; i < n; i++) {
    const bw = Math.max(2, Math.round(w * Math.sqrt(1 - ((i + 0.5) / n) ** 2)));
    out.push({ x, dx: -bw / 2, y: -(i + 1) * step, ground: true, w: bw, h: step, c, layer });
  }
  return out;
}

function meadow(R) {
  const sky = mix(M.base, M.sky, 0.06);
  const P = [];
  for (let i = 0; i < 3; i++) P.push(...dome(R.in(0.05, 0.95), R.in(150, 240), R.in(10, 18), mix(sky, M.green, 0.12)));
  for (let i = 0; i < 2; i++) P.push(...dome(R.in(0.1, 0.9), R.in(90, 140), R.in(6, 10), mix(sky, M.green, 0.2)));
  // Clouds, drifting.
  const cloud = mix(sky, M.text, 0.28);
  for (let i = 0; i < 3; i++) {
    const w = R.int(28, 44);
    P.push({
      x: (i + R.in(0.15, 0.85)) / 3, dx: -w / 2, y: R.in(4, 18), w, h: 10, layer: "far",
      parts: [{ dx: 0, dy: 4, w, h: 6, c: cloud, r: 3 }, { dx: w * 0.25, dy: 0, w: w * 0.35, h: 8, c: cloud, r: 4 }, { dx: w * 0.5, dy: 2, w: w * 0.3, h: 6, c: cloud, r: 3 }],
      loop: { prop: "left", from: -R.in(8, 14), to: R.in(8, 14), period: R.int(14000, 22000) },
    });
  }
  // Grass tufts and flowers on the line.
  for (let i = 0; i < 12; i++) {
    const c = R.f() < 0.5 ? M.green : M.teal;
    const h = R.int(2, 4);
    P.push({ x: R.f(), y: -h, ground: true, w: 3, h, layer: "near", parts: [{ dx: 0, dy: 1, w: 1, h: h - 1, c }, { dx: 1, dy: 0, w: 1, h, c }, { dx: 2, dy: 1, w: 1, h: h - 1, c }] });
  }
  for (let i = 0; i < 7; i++) {
    const c = R.pick([M.pink, M.yellow, M.red, M.text]);
    P.push({ x: R.f(), y: -5, ground: true, w: 3, h: 5, layer: "near", parts: [{ dx: 1, dy: 2, w: 1, h: 3, c: M.green }, { dx: 0, dy: 0, w: 3, h: 2, c, r: 1 }] });
  }
  return { sky, soil: mix(M.base, M.green, 0.07), line: mix(M.green, M.base, 0.35), dots: mix(M.base, M.green, 0.2), P };
}

function beach(R) {
  const sky = mix(M.base, M.sapphire, 0.08);
  const sea = mix(sky, M.sapphire, 0.32);
  const P = [];
  P.push({ x: R.in(0.75, 0.92), dx: -7, y: 5, w: 14, h: 14, r: 7, c: mix(sky, M.yellow, 0.7), layer: "far" });
  P.push({ x: 0, y: -13, ground: true, full: true, h: 2, c: mix(sky, M.sky, 0.22), layer: "far" });
  P.push({ x: 0, y: -11, ground: true, full: true, h: 11, c: sea, layer: "far" });
  // Wave crests rolling on the sea.
  const crest = mix(sea, M.text, 0.45);
  for (let i = 0; i < 9; i++) {
    const w = R.int(5, 10);
    P.push({ x: (i + R.f()) / 9, dx: -w / 2, y: -R.int(3, 9), ground: true, w, h: 1, c: crest, layer: "far", loop: { prop: "left", from: -3, to: 3, period: R.int(2200, 3800) } });
  }
  // Gulls.
  const gull = mix(sky, M.text, 0.55);
  for (let i = 0; i < 2; i++) {
    P.push({ x: R.in(0.2, 0.7), y: R.in(6, 16), w: 7, h: 2, layer: "far", parts: [{ dx: 0, dy: 0, w: 3, h: 1, c: gull }, { dx: 3, dy: 1, w: 1, h: 1, c: gull }, { dx: 4, dy: 0, w: 3, h: 1, c: gull }], loop: { prop: "top", from: -2, to: 2, period: R.int(1800, 2600) } });
  }
  // Palms leaning over the shore.
  const trunk = mix(sky, M.peach, 0.45);
  const frond = mix(sky, M.green, 0.5);
  for (let i = 0; i < 2; i++) {
    const lean = R.f() < 0.5 ? -1 : 1;
    const parts = [];
    for (let k = 0; k < 7; k++) parts.push({ dx: 14 + lean * Math.round((k * k) / 8), dy: 26 - (k + 1) * 4, w: 3, h: 4, c: trunk });
    const tx = parts[parts.length - 1].dx + 1; // the crown sits on the top segment
    parts.push({ dx: tx - 13, dy: -1, w: 12, h: 3, c: frond, r: 1 }, { dx: tx + 1, dy: -1, w: 12, h: 3, c: frond, r: 1 });
    parts.push({ dx: tx - 15, dy: 2, w: 3, h: 3, c: frond }, { dx: tx + 12, dy: 2, w: 3, h: 3, c: frond });
    parts.push({ dx: tx - 6, dy: -4, w: 5, h: 3, c: frond, r: 1 }, { dx: tx + 1, dy: -4, w: 5, h: 3, c: frond, r: 1 });
    parts.push({ dx: tx - 1, dy: 1, w: 3, h: 3, c: mix(sky, M.peach, 0.25), r: 1 });
    P.push({ x: (i + R.in(0.2, 0.8)) / 2, dx: -15, y: -26, ground: true, w: 30, h: 26, parts, layer: "far" });
  }
  // Shells on the sand.
  for (let i = 0; i < 6; i++) {
    const c = R.pick([M.pink, M.flamingo, M.rosewater, M.peach]);
    P.push({ x: R.f(), y: -2, ground: true, w: 4, h: 2, rt: 2, c, layer: "near" });
  }
  return { sky, soil: mix(M.base, M.peach, 0.12), line: mix(M.yellow, M.base, 0.3), dots: mix(M.base, M.yellow, 0.3), P };
}

function crag(R) {
  const sky = mix(M.base, M.crust, 0.65);
  const P = [];
  for (let i = 0; i < 18; i++) {
    const s = R.f() < 0.25 ? 2 : 1;
    const star = { x: R.f(), y: R.in(2, 30), w: s, h: s, c: mix(sky, M.text, R.in(0.45, 0.9)), layer: "far" };
    if (i % 3 === 0) star.loop = { prop: "opacity", from: 0.25, to: 1, period: R.int(1200, 3200) };
    P.push(star);
  }
  // A crescent moon: a disc, and a sky-colored disc over it.
  const mx = R.in(0.06, 0.2);
  P.push({ x: mx, y: 4, w: 13, h: 13, r: 7, c: mix(sky, M.rosewater, 0.75), layer: "far" });
  P.push({ x: mx, dx: 4, y: 2, w: 13, h: 13, r: 7, c: sky, layer: "far" });
  // Far range, then near crags.
  for (let i = 0; i < 4; i++) P.push(...peak((i + R.in(0.1, 0.9)) / 4, 0, R.in(70, 130), R.in(18, 33), mix(sky, M.surface2, 0.75), { cap: mix(sky, M.overlay1, 0.7), capN: 1 }));
  for (let i = 0; i < 3; i++) P.push(...peak(R.f(), 0, R.in(36, 60), R.in(9, 15), mix(sky, M.overlay0, 0.6)));
  // Rocks and glowing crystals on the line.
  for (let i = 0; i < 6; i++) {
    const w = R.int(6, 10);
    const h = R.int(3, 5);
    P.push({ x: R.f(), y: -h, ground: true, w, h, layer: "near", parts: [{ dx: 0, dy: 0, w, h, c: mix(sky, M.overlay1, 0.7), r: 2 }, { dx: 2, dy: 1, w: 2, h: 1, c: mix(sky, M.subtext1, 0.8) }] });
  }
  for (let i = 0; i < 4; i++) {
    const c = R.f() < 0.5 ? M.mauve : M.lavender;
    const parts = [];
    const shards = R.int(2, 3);
    for (let k = 0; k < shards; k++) {
      const h = R.int(4, 9);
      parts.push({ dx: k * 3, dy: 9 - h, w: 2, h, c: k === 1 ? c : mix(sky, c, 0.7) }, { dx: k * 3, dy: 9 - h, w: 2, h: 1, c: M.text });
    }
    const crystal = { x: R.f(), y: -9, ground: true, w: shards * 3, h: 9, parts, layer: "near" };
    if (i % 2 === 0) crystal.loop = { prop: "opacity", from: 0.6, to: 1, period: R.int(1600, 2600) };
    P.push(crystal);
  }
  return { sky, soil: mix(M.base, M.crust, 0.4), line: M.surface2, dots: mix(M.base, M.surface2, 0.6), P };
}

function snow(R) {
  const sky = mix(M.base, M.lavender, 0.07);
  const P = [];
  // Snow-capped range far away.
  for (let i = 0; i < 3; i++) P.push(...peak((i + R.in(0.1, 0.9)) / 3, 0, R.in(90, 150), R.in(21, 33), mix(sky, M.overlay0, 0.3), { cap: mix(sky, M.text, 0.55), capN: 3 }));
  // Pines: three snowy tiers on a trunk.
  const pine = mix(sky, M.teal, 0.42);
  const cap = mix(sky, M.text, 0.7);
  for (let i = 0; i < 6; i++) {
    const x = (i + R.in(0.1, 0.9)) / 6;
    const s = R.in(0.8, 1.2);
    P.push({ x, dx: -1, y: -3, ground: true, w: 3, h: 3, c: mix(sky, M.maroon, 0.4), layer: "far" });
    [[0, 18, 9], [6, 14, 8], [11, 10, 7]].forEach(([up, w, h]) => {
      P.push(...peak(x, -3 - up * s, w * s, h * s, pine, { step: 2, cap, capN: 1 }));
    });
  }
  // Drifts on the line.
  for (let i = 0; i < 5; i++) P.push(...dome(R.f(), R.in(20, 42), R.in(3, 6), mix(sky, M.text, 0.32), "near", 1));
  // Flakes, swaying down a little.
  const flake = mix(sky, M.text, 0.7);
  for (let i = 0; i < 16; i++) {
    const s = R.f() < 0.3 ? 2 : 1;
    P.push({ x: R.f(), y: R.in(2, 40), w: s, h: s, c: flake, layer: "near", loop: { prop: R.f() < 0.6 ? "top" : "left", from: -R.in(3, 6), to: R.in(3, 6), period: R.int(2600, 5200) } });
  }
  return { sky, soil: mix(M.base, M.text, 0.08), line: mix(M.sky, M.base, 0.3), dots: mix(M.base, M.text, 0.2), P };
}

function blossom(R) {
  const sky = mix(M.base, M.pink, 0.05);
  const P = [];
  for (let i = 0; i < 3; i++) P.push(...dome(R.in(0.05, 0.95), R.in(140, 220), R.in(8, 14), mix(sky, M.green, 0.12)));
  // Cherry trees: a trunk with two branches under round canopies.
  const bark = mix(sky, M.maroon, 0.4);
  const bloom = mix(sky, M.pink, 0.45);
  const light = mix(sky, M.flamingo, 0.6);
  for (let i = 0; i < 4; i++) {
    const x = (i + R.in(0.15, 0.85)) / 4;
    const h = R.int(14, 20);
    P.push({
      x, dx: -18, y: -(h + 16), ground: true, w: 36, h: h + 16, layer: "far",
      parts: [
        { dx: 16, dy: 14, w: 4, h: h + 2, c: bark },
        { dx: 10, dy: 16, w: 6, h: 2, c: bark },
        { dx: 20, dy: 13, w: 6, h: 2, c: bark },
        { dx: 0, dy: 6, w: 18, h: 14, c: bloom, r: 7 },
        { dx: 16, dy: 4, w: 20, h: 15, c: bloom, r: 7 },
        { dx: 8, dy: 0, w: 20, h: 14, c: bloom, r: 7 },
        { dx: 12, dy: 2, w: 6, h: 4, c: light, r: 2 },
        { dx: 24, dy: 7, w: 5, h: 3, c: light, r: 1 },
        { dx: 4, dy: 9, w: 4, h: 3, c: light, r: 1 },
      ],
    });
  }
  // Petals in the air and on the ground.
  for (let i = 0; i < 12; i++) {
    const c = R.f() < 0.5 ? M.pink : M.flamingo;
    P.push({ x: R.f(), y: R.in(4, 44), w: 2, h: 2, r: 1, c, layer: "near", loop: { prop: R.f() < 0.5 ? "top" : "left", from: -R.in(3, 7), to: R.in(3, 7), period: R.int(2400, 4600) } });
  }
  for (let i = 0; i < 8; i++) P.push({ x: R.f(), y: -1, ground: true, w: 2, h: 1, c: R.f() < 0.5 ? M.pink : M.flamingo, layer: "near" });
  for (let i = 0; i < 6; i++) {
    const h = R.int(2, 3);
    P.push({ x: R.f(), y: -h, ground: true, w: 3, h, layer: "near", parts: [{ dx: 0, dy: 1, w: 1, h: h - 1, c: M.green }, { dx: 2, dy: 0, w: 1, h, c: M.green }] });
  }
  return { sky, soil: mix(M.base, M.green, 0.06), line: mix(M.green, M.base, 0.4), dots: mix(M.base, M.pink, 0.22), P };
}

const BUILD = { meadow, beach, crag, snow, blossom };

// The scene for one town: { biome, sky, soil, line, dots, P }.
export function buildScene(biome, key) {
  const R = rng(`${biome}|${key}`);
  const s = BUILD[biome](R);
  // Soil specks under the name tags.
  s.specks = Array.from({ length: 14 }, () => ({ x: R.f(), w: R.int(1, 3) }));
  return { biome, ...s };
}

function propEl(p, i, W, G) {
  const top = p.ground ? G + p.y : p.y;
  let el = div().absolute().top(top).h(p.h);
  const left = p.full ? 0 : p.x * W + (p.dx ?? 0);
  el = p.full ? el.left(0).right(0) : el.left(left).w(p.w);
  if (p.c) el = el.bg(p.c);
  if (p.r) el = el.rounded(p.r);
  if (p.rt) el = el.rounded_t(p.rt);
  if (p.parts) {
    el = el.children(p.parts.map((q) => {
      let d = div().absolute().left(q.dx).top(q.dy).w(q.w).h(q.h).bg(q.c);
      return q.r ? d.rounded(q.r) : d;
    }));
  }
  if (p.loop) {
    const L = p.loop;
    const base = L.prop === "left" ? left : L.prop === "top" ? top : 0;
    el = el.id(`scene-${i}`).loop(L.prop, { from: base + L.from, to: base + L.to, period: L.period, easing: "ease-in-out" });
  }
  return el;
}

// The backdrop as two lists of elements: under (sky, far props, ground line,
// near props, soil) goes before the Pokémon. Sky props that would dip under
// the ground line (a short strip) are left out.
export function scenery(scene, W, H, G) {
  const out = [];
  out.push(div().absolute().left(0).right(0).top(0).h(G).bg(scene.sky));
  out.push(div().absolute().left(0).right(0).top(G).bottom(0).bg(scene.soil));
  const fits = (p) => {
    const top = p.ground ? G + p.y : p.y;
    return top >= 0 && (p.ground || top + p.h <= G - 4);
  };
  scene.P.forEach((p, i) => { if (p.layer === "far" && fits(p)) out.push(propEl(p, i, W, G)); });
  out.push(div().absolute().left(0).right(0).top(G).h(2).bg(scene.line));
  scene.P.forEach((p, i) => { if (p.layer !== "far" && fits(p)) out.push(propEl(p, i, W, G)); });
  // Specks along the very bottom, below the name tags.
  const sy = Math.max(G + 19, H - 4);
  if (sy + 1 < H) for (const s of scene.specks) out.push(div().absolute().left(s.x * W).top(sy).w(s.w).h(1).bg(scene.dots));
  return out;
}
