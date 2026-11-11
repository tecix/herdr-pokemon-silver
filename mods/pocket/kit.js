// Pocket: shared pieces for every role. Roles import from here; keep this the
// one place for the palette, fonts, frames, bars, Pokémon art, levels and events.
//
// Look: Catppuccin Macchiato (dark) or Rosé Pine Dawn (light), drawn like a Gen 2 handheld screen
// (double-bordered text boxes, green/yellow/red HP bars, blue EXP bar).
// Roles use the named colors below only (no theme(), no other hex).
// The palette follows the theme (syncTheme).

import { div, image, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, layout, focused, appHome, hc, exec, shared, setShared, agents, spaces, openOverlay, settings, panes, terminals, playSound, run } from "herdr";
import { monOf, monName, artOf, agentList, monKey, shinyOf, evolutionOf, setMon, setShiny, windowId } from "./mons.js";
export { agentList };

// The palette follows the shown theme (the layout's {light, dark}, or the
// theme picker): syncTheme() refills M and the names below before every
// render (main.js), so roles keep reading M.<name> at render time. Never copy
// a color into a module-level constant; it would miss theme changes.
// Dark: Catppuccin Macchiato (themes/pocket.json).
const MACCHIATO = {
  rosewater: "#f4dbd6", flamingo: "#f0c6c6", pink: "#f5bde6", mauve: "#c6a0f6",
  red: "#ed8796", maroon: "#ee99a0", peach: "#f5a97f", yellow: "#eed49f",
  green: "#a6da95", teal: "#8bd5ca", sky: "#91d7e3", sapphire: "#7dc4e4",
  blue: "#8aadf4", lavender: "#b7bdf8", text: "#cad3f5", subtext1: "#b8c0e0",
  subtext0: "#a5adcb", overlay2: "#939ab7", overlay1: "#8087a2", overlay0: "#6e738d",
  surface2: "#5b6078", surface1: "#494d64", surface0: "#363a4f", base: "#24273a",
  mantle: "#1e2030", crust: "#181926",
};
// Light: Rosé Pine Dawn (themes/pocket-light.json), under Catppuccin's names.
// Light themes run the other way: surfaces darken toward text, and crust (the
// track and pill-text color) stays pale so text on colored pills reads.
const DAWN = {
  rosewater: "#d7827e", flamingo: "#d7827e", pink: "#d7827e", mauve: "#907aa9",
  red: "#b4637a", maroon: "#b4637a", peach: "#cf8057", yellow: "#ea9d34",
  green: "#286983", teal: "#3f7f91", sky: "#56949f", sapphire: "#56949f",
  blue: "#56949f", lavender: "#9d8ab4", text: "#575279", subtext1: "#686487",
  subtext0: "#797593", overlay2: "#88839d", overlay1: "#9893a5", overlay0: "#b5b0bd",
  surface2: "#cecacd", surface1: "#dfdad9", surface0: "#f4ede8", base: "#faf4ed",
  mantle: "#f2e9e1", crust: "#efe6de",
};
// Palettes by theme background; any other theme is derived from its colors.
const KNOWN = { "#24273a": MACCHIATO, "#faf4ed": DAWN };

export const M = { ...MACCHIATO };
// Roles' names (kept from the first build): INK = text, DARK = secondary text,
// LIGHT = the canvas behind boxes, PAPER = a box's fill. SELECT = a focused
// box's fill, EDGE = box border, FOCUS = focused box border. Live bindings:
// syncTheme() reassigns them.
export let INK = M.text;
export let DARK = M.subtext0;
export let LIGHT = M.mantle;
export let PAPER = M.base;
export let SELECT = M.surface0;
export let EDGE = M.lavender;
export let FOCUS = M.mauve;
// Gym badge colors, in order: badge i is BADGE_COLORS[i]; 8 slots.
export const BADGE_SLOTS = 8;
export const BADGE_COLORS = [];
export function badgeCount() {
  return Math.min(BADGE_SLOTS, Math.max(0, Number(shared("pocket.badges")) || 0));
}
export const STATUS_COLOR = {};

function hex6(c, fallback) {
  return typeof c === "string" && /^#[0-9a-fA-F]{6}/.test(c) ? c.slice(0, 7).toLowerCase() : fallback;
}
function mixHex(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const x = p(a);
  const y = p(b);
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
function luma(h) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
// Catppuccin's names from any Herdr theme's colors.
function derive(t) {
  const d = MACCHIATO;
  const c = (k, f) => hex6(t[k], f);
  const base = c("background", d.base);
  const light = luma(base) > 0.5;
  const text = c("foreground", d.text);
  const red = c("ansi1", d.red), green = c("ansi2", d.green), yellow = c("ansi3", d.yellow);
  const blue = c("ansi4", d.blue), pink = c("ansi5", d.pink), teal = c("ansi6", d.teal);
  const accent = c("accent", pink);
  const muted = c("muted", mixHex(text, base, 0.25)), dim = c("dim", mixHex(text, base, 0.45));
  const mantle = c("canvas", mixHex(base, "#000000", light ? 0.04 : 0.15));
  return {
    rosewater: mixHex(pink, text, 0.2), flamingo: mixHex(red, pink, 0.5), pink, mauve: accent,
    red, maroon: c("ansi9", red), peach: mixHex(red, yellow, 0.5), yellow,
    green, teal, sky: mixHex(teal, blue, 0.35), sapphire: mixHex(blue, teal, 0.5),
    blue, lavender: c("ring", mixHex(blue, accent, 0.5)), text, subtext1: mixHex(text, muted, 0.5),
    subtext0: muted, overlay2: mixHex(muted, dim, 0.5), overlay1: dim, overlay0: c("input", mixHex(dim, base, 0.35)),
    surface2: c("border", mixHex(base, text, 0.25)), surface1: c("selected", mixHex(base, text, 0.15)),
    surface0: c("hover", mixHex(base, text, 0.08)), base, mantle,
    crust: light ? mixHex(mantle, text, 0.03) : mixHex(mantle, "#000000", 0.2),
  };
}
let themeNow = null;
export function syncTheme() {
  let t = {};
  try {
    t = theme() ?? {};
  } catch {}
  const key = JSON.stringify(t);
  if (key === themeNow) return;
  themeNow = key;
  Object.assign(M, KNOWN[hex6(t.background, "")] ?? derive(t));
  INK = M.text;
  DARK = M.subtext0;
  LIGHT = M.mantle;
  PAPER = M.base;
  SELECT = M.surface0;
  EDGE = M.lavender;
  FOCUS = M.mauve;
  BADGE_COLORS.splice(0, BADGE_COLORS.length, M.red, M.peach, M.yellow, M.green, M.teal, M.blue, M.mauve, M.pink);
  Object.assign(STATUS_COLOR, { working: M.blue, blocked: M.red, done: M.green, idle: M.overlay1 });
}

// Language: shared "pocket.lang" = "vi" | "en" (default "vi").
export function lang() {
  return shared("pocket.lang") === "en" ? "en" : "vi";
}
export function isEn() {
  return lang() === "en";
}
export function setLang(l) {
  setShared("pocket.lang", l === "en" ? "en" : "vi");
}
export function toggleLang() {
  setLang(isEn() ? "vi" : "en");
}
export function tr(vi, en) {
  return isEn() ? en : vi;
}

// Fonts: the Galmuri family (OFL, in fonts/, full Vietnamese): Galmuri9 (10px
// grid) for text, Galmuri7 (8px) for small text, Galmuri11 (12px) for big
// text. Pixel fonts are only sharp at whole multiples of their grid in SCREEN
// pixels, and the app zoom (settings zoom) scales logical px. So each size is
// the whole multiple of its grid nearest to the look it was drawn for (2x at
// zoom 1.3: 20, 16, 24 screen px), divided by the zoom. syncZoom() redoes them
// when the zoom changes (main.js calls it before every render); the exports are
// live bindings, so importers see the new values.
export const FONT = "Galmuri9";
export const FONT_SMALL = "Galmuri7";
export const FONT_BIG = "Galmuri11";
const DRAWN_AT = 1.3; // the zoom the sizes were tuned at
const SIZES = { TEXT: [10, 20], SMALL: [8, 16], BIG: [12, 24] }; // grid, screen px at DRAWN_AT
export let TEXT = 20 / DRAWN_AT;
export let SMALL = 16 / DRAWN_AT;
export let BIG = 24 / DRAWN_AT;
let zoomNow = null;
function pixelSize([grid, px], z) {
  const k = Math.max(1, Math.round((px / DRAWN_AT) * z / grid));
  return (grid * k) / z;
}
export function syncZoom() {
  let z = DRAWN_AT;
  try { z = zoom(); } catch {}
  if (z === zoomNow) return false;
  zoomNow = z;
  TEXT = pixelSize(SIZES.TEXT, z);
  SMALL = pixelSize(SIZES.SMALL, z);
  BIG = pixelSize(SIZES.BIG, z);
  return true;
}
// Line heights with room for Vietnamese stacked accents (lhPx: as a number).
export const lhPx = (size) => Math.round(size * 1.25 * 100) / 100;
export const LH = (size) => `${lhPx(size)}px`;
export const fontFor = (size) => (size <= SMALL + 0.01 ? FONT_SMALL : size >= BIG - 0.01 ? FONT_BIG : FONT);

// A Gen 2 text box: a 2px outer line, a 2px gap of fill, a thin inner line.
// `inverted` (kept name) = focused/selected: SELECT fill, FOCUS border.
// `edge`: another outer border color (e.g. M.red for an agent waiting on you).
// Pass `id` for clicks, `full` to fill the parent.
export function frame(content, o = {}) {
  const sel = Boolean(o.inverted);
  const fill = sel ? SELECT : PAPER;
  const inner = div()
    .flex_1()
    .min_h(0)
    .flex()
    .flex_col()
    .border(1)
    .border_color(sel ? M.mauve : M.surface2)
    .bg(fill)
    .text_color(INK)
    .font_family(fontFor(o.size ?? TEXT))
    .text_size(o.size ?? TEXT)
    .line_height(LH(o.size ?? TEXT))
    .p(o.pad ?? 6)
    .child(content);
  let outer = div().flex().flex_col().border(2).border_color(o.edge ?? (sel ? FOCUS : EDGE)).rounded(3).bg(fill).p(2).child(inner);
  if (o.id) outer = outer.id(o.id);
  if (o.full) outer = outer.size_full();
  return outer;
}

// Pixel glyphs for symbols drawn as SVG (▶ ▼ ◆ ◇ □ ⎇ ✓ gear), tinted with the text
// color: "cursor", "more", "badge", "badge-empty", "zoom", "branch", "check",
// "gear", plus "pokeball" (full color: use image(), or kit pokeball()).
// Pictures and sounds load from data/pocket/ui (install.sh and tools/watch.py
// copy glyphs/, sprites/, sounds/ there and draw pokeball.svg): Herdr loads no
// image or sound behind a symlink, and the default install links mods/pocket
// to the repo. A path that failed to load stays failed until Herdr restarts, so
// they are written before the mod reloads.
export const UI = "data/pocket/ui";
export function glyph(name, size = 10) {
  return svg(`${UI}/glyphs/${name}.svg`).size(size).flex_none();
}
// Blink anything natively (no timer).
export function blink(el, period = 1000) {
  return el.loop("opacity", { from: 0, to: 1, period });
}

// The blinking menu cursor (native animation, no timer).
export function cursor(on = true) {
  return div().w(14).flex_none().flex().items_center().text_color(INK).child(on ? blink(glyph("cursor", 10)) : div());
}

// A Gen 2 bar, `pct` 0..100: a small label, then the track.
// HP colors itself: green above 50%, yellow above 20%, red below (and blinks
// with o.blink). Pass o.fg for a fixed color (EXP uses M.blue).
export function hpColor(p) {
  return p > 50 ? M.green : p > 20 ? M.yellow : M.red;
}
export function bar(label, pct, w = 96, o = {}) {
  const known = pct != null && Number.isFinite(Number(pct));
  const p = known ? Math.max(0, Math.min(100, Math.round(pct))) : 0;
  const color = o.fg ?? hpColor(p);
  const fill = div().h_full().rounded(1).bg(color).w(Math.round((w - 4) * p / 100));
  let track = div().w(w).h(o.h ?? 7).flex_none().border(1).border_color(M.surface2).rounded(2).bg(o.bg ?? M.crust).p(1).flex().child(fill);
  if (!known) track = track.opacity(0.5);
  if (known && o.blink && p <= 20) track = track.loop("opacity", { from: 0.35, to: 1, period: 900 });
  if (!label && !o.labelW) return h_flex().flex_none().items_center().child(track);
  return h_flex()
    .gap(4)
    .items_center()
    .flex_none()
    .child(div().when(o.labelW != null, (e) => e.w(o.labelW)).flex_none().text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(o.labelColor ?? M.yellow).child(label))
    .child(track);
}

// A Pokémon's picture for a pane. kind: "front" (still), "anim" (Crystal's
// animation, GIF), "icon" (40x30 menu icon). size: shown px (56 or 112 for
// front/anim are pixel-exact; icon is 40x30 native). A Poké Ball pulses while
// the art downloads.
export function zoom() {
  const z = Number(settings()?.zoom);
  return Number.isFinite(z) && z > 0 ? z : 1;
}
// Pixel-exact size: the logical px that shows `native` art at a whole number of
// screen pixels per art pixel (the app zoom scales logical px), as close to
// `want` (logical px) as possible without going over when it can.
export function crisp(native, want) {
  const z = zoom();
  const k = Math.max(1, Math.floor((want * z) / native + 0.25));
  return (native * k) / z;
}
export function mon(pane, kind = "front", size = 64) {
  const art = artOf(monKey(pane));
  // Native art: Gen 3 Emerald sprites 64x64, menu icons 40x30. The 2x files exist
  // for k >= 2 so big ones stay sharp without the GPU scaling them.
  const native = kind === "icon" ? 30 : 64;
  const h = crisp(native, size);
  const w = kind === "icon" ? (h * 4) / 3 : h;
  if (!art) return pokeball(Math.round(h * 0.5)).w(w).h(h);
  const big = h * zoom() >= native * 2 - 0.5;
  const path = kind === "icon" ? (big ? art.icon2 ?? art.icon : art.icon) : big ? art[kind + "2"] : art[kind];
  return image(path).w(w).h(h).flex_none();
}
// A Pokémon fitted into a `box` x `box` square (logical px): centered on its
// visible pixels (Art.box), at the largest whole-pixel scale (1x or 2x art) whose
// visible part fits. o.align "bottom" stands it on the box's bottom instead.
export function monFit(pane, kind = "front", box = 46, o = {}) {
  const art = artOf(monKey(pane));
  const holder = div().w(box).h(box).flex_none().relative().overflow_hidden();
  if (!art) return holder.flex().items_center().justify_center().child(pokeball(Math.round(box * 0.5)));
  const z = zoom();
  const native = kind === "icon" ? [40, 30] : [64, 64];
  const b = art.box?.[kind] ?? [0, 0, native[0], native[1]];
  const vis = Math.max(b[2] - b[0], b[3] - b[1], 1);
  const nw = b[4] ?? native[0];
  const nh = b[5] ?? native[1];
  const k = kind === "icon" ? 1 : Math.max(1, Math.min(2, Math.floor((box * z) / vis)));
  const path = kind === "icon" ? art.icon : k === 2 ? art[kind + "2"] : art[kind];
  const w = (nw * k) / z;
  const h = (nh * k) / z;
  // Snap offsets to whole screen pixels so the art stays crisp.
  const snap = (v) => Math.round(v * z) / z;
  const cx = ((b[0] + b[2]) / 2) * k / z;
  const left = snap(box / 2 - cx);
  const top = o.align === "bottom" ? snap(box - (b[3] * k) / z - 1) : snap(box / 2 - (((b[1] + b[3]) / 2) * k) / z);
  return holder.child(image(path).absolute().left(left).top(top).w(w).h(h));
}

// A still Poké Ball (no pulse): the plain terminal's icon in the pane header.
export function pokeballStill(size = 18) {
  return image(`${UI}/pokeball.svg`).size(size).w(size).h(size).flex_none();
}
export function pokeball(size = 18) {
  const ball = image(`${UI}/pokeball.svg`).size(size).w(size).h(size).flex_none();
  return div().flex().items_center().justify_center().flex_none().child(ball.loop("opacity", { from: 0.45, to: 1, period: 900 }));
}
// Opens the picker (role "picker") to choose the Pokémon for a pane.
// A pane's own name, given by right-clicking its header (role "rename"):
// shared "pocket.names" = { [pane id]: name }. "" or null clears it.
export function paneName(pane) {
  return (pane && shared("pocket.names")?.[pane]) || "";
}
export function setPaneName(pane, name) {
  if (!pane) return;
  const all = { ...(shared("pocket.names") ?? {}) };
  const n = String(name ?? "").trim();
  if (n) all[pane] = n;
  else delete all[pane];
  setShared("pocket.names", all);
}
export function openRename(pane, value = "") {
  if (!pane) return;
  openOverlay({ mod: "pocket", kind: "dialog", width: 420, height: 180, props: { role: "rename", pane, value } });
}
export function openRenameTab(tab, value = "") {
  if (!tab) return;
  openOverlay({ mod: "pocket", kind: "dialog", width: 420, height: 180, props: { role: "rename", tab, value } });
}
// The agent info dialog (role "agent"): right-click a party card (not its icon).
export function openAgentInfo(address) {
  if (!address) return;
  openOverlay({ mod: "pocket", kind: "dialog", frame: "none", width: 760, height: 540, props: { role: "agent", address } });
}
// The town card dialog (role "town"): right-click a town row or map town.
export function openTown(spaceId) {
  if (!spaceId) return;
  openOverlay({ mod: "pocket", kind: "dialog", frame: "none", width: 560, height: 400, props: { role: "town", space: spaceId } });
}
// A Pokémon's moves (role "fight"): a popup at the pointer, from the field.
export function openFight(address, pane) {
  if (!address || !pane) return;
  openOverlay({ mod: "pocket", kind: "popup", frame: "none", width: 270, height: 238, props: { role: "fight", address, pane } });
}
export function openPicker(pane) {
  if (!pane) return;
  openOverlay({ mod: "pocket", kind: "dialog", width: 640, height: 560, props: { role: "picker", pane } });
}

// The agent's own name (its program: "Claude Code", "Codex"...). Shown first;
// the Pokémon's name is second.
export function agentName(a) {
  if (!a) return "Agent";
  // A name given from the pane's header (openRename) wins.
  const own = paneName(a.pane);
  if (own) return own;
  // Then a tab someone named (tab.rename); then the Claude session's name.
  const tab = spaces().flatMap((s) => s.tabs).find((t) => t.id === a.tab);
  if (tab?.named && tab.name) return tab.name;
  if (a.session_name) return a.session_name;
  const prog = a.program && !a.program.shell ? a.program.name : null;
  // The pane's name: its terminal title, without a leading status glyph
  // (Claude's ✳ ◐ ⠂ …), unless it just repeats the program's name.
  const title = String(a.title ?? "").replace(/^[^\p{L}\p{N}\[(]+/u, "").trim();
  if (title && title !== prog && !/^(zsh|bash|fish|sh)$/.test(title)) return title;
  return prog || "Agent";
}
// A model's short name, to save room: the first word's first two letters, the
// version, then the initials of the words after it: "Opus 5.5" -> "Op5.5",
// "Gemini 3.8 Flash" -> "Ge3.8F", "Kimi K3.1 Pro" -> "Ki3.1P", "gpt-5.5-codex"
// -> "GPT5.5C". No version: the first word (cut at 8).
export function shortModel(model) {
  if (!model) return "";
  const words = String(model).trim().split(/[\s_-]+/).filter(Boolean);
  const at = words.findIndex((w, i) => i > 0 && /\d/.test(w));
  if (at < 0) return words[0].slice(0, 8);
  const first = words[0];
  const head = first.length <= 3 ? first.toUpperCase() : first[0].toUpperCase() + first.slice(1, 2);
  // "K3.1" after "Kimi": the letter repeats the name, keep the number.
  const ver = words[at].replace(new RegExp(`^${first[0]}(?=\\d)`, "i"), "");
  const tail = words.slice(at + 1).map((w) => w[0].toUpperCase()).join("");
  return (head + ver + tail).slice(0, 9);
}
// Effort as signal bars: low 1, medium 2, high 3, xhigh 4, max 5 of 5.
const EFFORT = { low: 1, medium: 2, high: 3, xhigh: 4, max: 5 };
export function effortBars(effort, size = SMALL) {
  const n = EFFORT[effort] ?? 0;
  if (!n) return null;
  const hMax = Math.round(size * 0.7);
  return h_flex()
    .flex_none()
    .items_end()
    .gap(1)
    .h(hMax)
    .children([1, 2, 3, 4, 5].map((i) =>
      div().w(2).h(Math.max(2, Math.round((hMax * i) / 5))).rounded(1).bg(i <= n ? M.peach : M.surface2)));
}
// The agent's product and model, small: the program's icon, the model and
// effort bars when known (Claude Code via agent-info.py, other agents from
// their screen: mons.js screenFacts), else the program's name. Short model
// ("Op5.5") unless o.full.
export function modelBadge(a, size = SMALL, o = {}) {
  const p = a?.program;
  const text = a?.model ? (o.full ? a.model : shortModel(a.model)) : p?.name ?? "";
  const ic = Math.round(size * 1.1);
  const icon = !p?.icon ? null : p.tint ? svg(p.icon).size(ic).flex_none().text_color(DARK) : image(p.icon).size(ic).flex_none();
  const bars = (o.effort && a?.model) ? effortBars(a.effort, size) : null;
  return h_flex()
    .flex_none()
    .gap(4)
    .items_center()
    .when(Boolean(icon), (e) => e.child(icon))
    .child(div().whitespace_nowrap().text_size(size).line_height(LH(size)).font_family(fontFor(size)).text_color(DARK).child(text))
    .when(Boolean(bars), (e) => e.child(bars));
}

// What the Pokémon is doing, from the agent (the same rules as
// mathieucroset/herdr-pokemon-agents): "walk" while working, "alert" when
// blocked (a "!" bubble), "happy" when done (a "✓"), "sleep" once its tab
// hasn't changed for 3 minutes while idle (or never changed since Herdr
// started), else "rest".
export const SLEEP_AFTER = 3 * 60 * 1000;
export function moodOf(a) {
  if (!a) return "rest";
  if (a.status === "working") return "walk";
  if (a.status === "blocked") return "alert";
  if (a.status === "done") return "happy";
  const tab = spaces().flatMap((s) => s.tabs).find((t) => t.id === a.tab);
  const changed = tab?.changed_at;
  return changed == null || Date.now() - changed > SLEEP_AFTER ? "sleep" : "rest";
}
// The bubble for a mood (native animation only): "!" pulsing red, "✓" green,
// "z zZ zZz" cycling for sleep. Null for walk/rest.
export function moodBubble(mood, size = SMALL) {
  const pillEl = (text, bg) => div().flex_none().px(4).rounded(6).bg(bg).text_color(M.crust).text_size(size).line_height(LH(size)).font_family(fontFor(size)).child(text);
  if (mood === "alert") return pillEl("!", M.red).loop("opacity", { from: 0.7, to: 1, period: 900 });
  if (mood === "happy") return div().flex_none().px(4).py(2).rounded(6).bg(M.green).text_color(M.crust).child(glyph("check", Math.round(size * 0.6)));
  if (mood === "sleep") return div().flex_none().w(Math.round(size * 1.6)).text_color(M.overlay2).text_size(size).font_family(fontFor(size)).frames(["z", "zZ", "zZz", "zZ"], 700);
  return null;
}

// A Gen 2 status condition tag (like SLP / PSN beside the HP bar), for the
// cards, the header and the PC box: walk "ĐÁNH"/"FIGHT" (dots cycle), alert
// "CHỜ!"/"WAIT!" (pulses red), happy "XONG"/"DONE", sleep "NGỦ"/"SLP" (grey).
// Null when resting. Fixed width so the line doesn't jitter. The field keeps
// its bubbles (moodBubble).
const CONDITION_VI = {
  walk: { text: ["ĐÁNH", "ĐÁNH.", "ĐÁNH..", "ĐÁNH..."], bg: "blue" },
  alert: { text: "CHỜ!", bg: "red" },
  happy: { text: "XONG", bg: "green" },
  sleep: { text: "NGỦ", bg: "overlay0" },
};
const CONDITION_EN = {
  walk: { text: ["FIGHT", "FIGHT.", "FIGHT..", "FIGHT..."], bg: "blue" },
  alert: { text: "WAIT!", bg: "red" },
  happy: { text: "DONE", bg: "green" },
  sleep: { text: "SLP", bg: "overlay0" },
};
export function condition(mood, size = SMALL) {
  const c = (isEn() ? CONDITION_EN : CONDITION_VI)[mood];
  if (!c) return null;
  let tag = div()
    .flex_none()
    .w(Math.round(size * 4.4))
    .h(Math.round(size * 1.25))
    .flex()
    .items_center()
    .justify_center()
    .rounded(3)
    .bg(M[c.bg])
    .text_color(M.crust)
    .text_size(size)
    .font_family(fontFor(size))
    .line_height(LH(size));
  tag = Array.isArray(c.text) ? tag.frames(c.text, 300) : tag.child(c.text);
  if (mood === "alert") tag = tag.loop("opacity", { from: 0.6, to: 1, period: 900 });
  return tag;
}

// The Pokémon's name for a pane, upper case (Gen 2 style).
export function monNameOf(pane) {
  return monName(monOf(pane));
}

// Sprites: original 16x16 pixel creatures, one per known agent program, drawn
// in the four shades (full-color SVGs, so image(), not svg()).
export const SPRITES = ["claude", "codex", "opencode", "gemini", "antigravity", "shell", "wild"];
export function spriteKey(program) {
  if (!program) return "wild";
  if (program.shell) return "shell";
  return SPRITES.includes(program.key) ? program.key : "wild";
}
export function sprite(program, size = 32) {
  return image(`${UI}/sprites/${spriteKey(program)}.svg`).w(size).h(size).flex_none();
}

// A monster's name: the program's name, upper case, at most 10 letters.
export function monsterName(program, title) {
  const n = (program && !program.shell && program.name) || title || "SHELL";
  const word = n.replace(/ Code$/i, "").toUpperCase();
  return word.length > 10 ? word.slice(0, 10) : word;
}

// Status, in game words. `tag` is the badge text ("" for none).
export const STATUS = {
  working: { get tag() { return tr("ĐÁNH", "FIGHT"); }, get say() { return tr("đang ra đòn", "working"); } },
  blocked: { get tag() { return tr("CHỜ!", "WAIT!"); }, get say() { return tr("đang chờ bạn", "waiting on you"); } },
  done: { get tag() { return tr("XONG", "DONE"); }, get say() { return tr("đã xong việc", "finished"); } },
  idle: { get tag() { return "zzz"; }, get say() { return tr("đang nghỉ", "resting"); } },
};
export function statusTag(status) {
  return STATUS[status]?.tag ?? "";
}

// HP = what's left of the agent's 5-hour limit, in percent (100 - used): shared
// "pocket.hp" (mons.js loader, usage5h.py, per machine and product) and the
// "5-hour" window Over9k's machine panel keeps in shared "machines.stats".
// Usage only grows inside one window, and an idle Claude session can write an
// old, lower number into the shared cache, so: the current window (latest
// reset time not yet passed) and the highest use seen for it. A window whose
// reset has passed is full again. Unknown: null (a dim, empty bar).
export const SAME_WINDOW = 300; // s: reset times this close are one window
const machineOf = (agent) => (agent?.address?.includes("/") ? agent.address.split("/")[0] : "");
// Every usage window known for the agent's product on its machine, from
// shared "pocket.hp" (windows, or just the 5-hour used/resets_at) and Over9k's
// "machines.stats" limits, by id ("5h", "7d", "7d:Opus", "month", ...):
// [{ id, used, resets_at (unix s or null), reset: true when it has passed }],
// 5h first, then 7d, then month. Same rules as HP: the current window and the
// highest use seen for it; a window whose reset has passed is empty again.
const WINDOW_ORDER = ["5h", "7d", "month"];
export const AGY_ORDER = ["7d:Gemini", "5h:Gemini", "7d:Other", "5h:Other", "7d:Argon"];
const AGY_VALID_WINDOWS = new Set(AGY_ORDER);
export function limitsForProduct(key, machine = "") {
  if (!key) return [];
  const now = Date.now() / 1000;
  const byId = new Map();
  const normId = (raw) => {
    let id = windowId(raw);
    if (key === "antigravity") {
      if (id === "5h") id = "5h:Gemini";
      else if (id === "7d") id = "7d:Gemini";
      if (!AGY_VALID_WINDOWS.has(id)) return null;
    }
    return id;
  };
  const add = (rawId, used, resets_at) => {
    const id = normId(rawId);
    if (!id || used == null || !Number.isFinite(Number(used))) return;
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push({ used: Number(used), resets_at: resets_at ?? null });
  };
  const mine = shared("pocket.hp")?.[machine]?.[key];
  if (Array.isArray(mine?.windows)) for (const w of mine.windows) add(w.id, w.used, w.resets_at);
  else if (mine) add("5h", mine.used, mine.resets_at);
  const lim = shared("machines.stats")?.[machine]?.limits?.[key];
  for (const w of lim?.windows ?? []) add(w.name, w.used, w.resets_at ? w.resets_at / 1000 : null);
  const out = [];
  for (const [id, found] of byId) {
    const live = found.filter((f) => !f.resets_at || f.resets_at > now);
    if (!live.length) {
      out.push({ id, used: 0, resets_at: null, reset: true });
      continue;
    }
    const latest = Math.max(...live.map((f) => f.resets_at ?? 0));
    const same = live.filter((f) => !f.resets_at || latest - f.resets_at < SAME_WINDOW);
    out.push({ id, used: Math.max(0, Math.min(100, Math.max(...same.map((f) => f.used)))), resets_at: latest || null, reset: false });
  }
  if (key === "antigravity") {
    return out.sort((a, b) => {
      const ia = AGY_ORDER.indexOf(a.id);
      const ib = AGY_ORDER.indexOf(b.id);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.id.localeCompare(b.id);
    });
  }
  const rank = (id) => {
    const i = WINDOW_ORDER.indexOf(id.split(":")[0]);
    return (i < 0 ? 9 : i) * 2 + (id.includes(":") ? 1 : 0);
  };
  return out.sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
}
export function limitsOf(agent) {
  return limitsForProduct(agent?.program?.key, machineOf(agent));
}
// The account behind the limits, when Over9k's machine panel or usage5h.py knows it:
// { plan, account, failed } or null.
export function productAccountOf(key, machine = "") {
  if (!key) return null;
  const lim = shared("machines.stats")?.[machine]?.limits?.[key];
  const hpPlan = shared("pocket.hp")?.[machine]?.[key]?.plan ?? null;
  const plan = lim?.plan ?? hpPlan ?? null;
  const account = lim?.account ?? null;
  const failed = lim?.failed ?? lim?.why ?? null;
  return plan || account || failed ? { plan, account, failed } : null;
}
export function limitAccountOf(agent) {
  return productAccountOf(agent?.program?.key, machineOf(agent));
}
// When the agent's usage numbers were last read (unix s), or null.
export function limitsAt(agent) {
  const at = shared("pocket.hp")?.[machineOf(agent)]?.[agent?.program?.key]?.at;
  return Number.isFinite(Number(at)) ? Number(at) : null;
}
export function hpOf(agent) {
  const lims = limitsOf(agent);
  if (agent?.program?.key === "antigravity") {
    const isOther = agent.model && !/^gemini\b/i.test(agent.model);
    const want = isOther ? "5h:Other" : "5h:Gemini";
    const match = lims.find((w) => w.id === want) ?? lims.find((w) => w.id.startsWith("5h"));
    return match ? 100 - match.used : null;
  }
  const five = lims.find((w) => w.id === "5h") ?? lims.find((w) => w.id.startsWith("5h"));
  return five ? 100 - five.used : null;
}

// Levels: shared "pocket.levels" = { [address]: { lv, exp } }. Every finished
// job ("done") gives EXP_PER_DONE; 100 EXP is a level. New monsters start at Lv 5.
// EXP: every finished job gives EXP_PER_DONE (3 jobs fill the bar). A full
// bar evolves the agent's Pokémon (Gen 1 line, mons.js), or, with no
// evolution left, turns it shiny; the bar starts over. A shiny final form keeps
// a full bar. shared "pocket.levels" = { [address]: { exp } } (old entries also
// have lv, unused). Badges = shared "pocket.badges" (evolutions + shinies).
export const EXP_PER_DONE = 34;
export function levelOf(address) {
  return shared("pocket.levels")?.[address] ?? { exp: 0 };
}
function gainExp(a) {
  const all = { ...(shared("pocket.levels") ?? {}) };
  let exp = Math.min(100, (all[a.address]?.exp ?? 0) + EXP_PER_DONE);
  let change = null;
  if (exp >= 100 && a.pane) {
    const from = monOf(a.pane);
    const to = evolutionOf(from, a.pane);
    if (to) change = { kind: "evolve", from, to };
    else if (!shinyOf(a.pane)) change = { kind: "shiny", from, to: from };
    if (change) {
      exp = 0;
      if (change.kind === "evolve") {
        const shiny = shinyOf(a.pane);
        setMon(a.pane, to);
        if (shiny) setShiny(a.pane, true);
      } else setShiny(a.pane, true);
      setShared("pocket.badges", (Number(shared("pocket.badges")) || 0) + 1);
    }
  }
  all[a.address] = { exp };
  setShared("pocket.levels", all);
  return { exp, change };
}

// Events: shared "pocket.events" = newest first, at most 50:
// { id, at, text, address, kind: "done" | "blocked" | "evolve" | "shiny" | "info", read? }.
// read: seen in the inbox (role "inbox", kit openInbox) or opened from the box.
export const EVENTS_MAX = 50;
export function events() {
  return shared("pocket.events") ?? [];
}
export function pushEvent(text, address = null, kind = "info", extra = {}) {
  const list = [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, at: Date.now(), text, address, kind, ...extra }, ...events()].slice(0, EVENTS_MAX);
  setShared("pocket.events", list);
}
export function eventText(e) {
  if (!e) return "";
  if (e.name) {
    if (e.kind === "evolve" && e.from && e.to) {
      return tr(
        `${monName(e.from)} của ${e.name} tiến hóa thành ${monName(e.to)}!`,
        `${e.name}'s ${monName(e.from)} evolved into ${monName(e.to)}!`,
      );
    }
    if (e.kind === "shiny" && e.from) {
      return tr(
        `${monName(e.from)} của ${e.name} trở thành shiny!`,
        `${e.name}'s ${monName(e.from)} turned shiny!`,
      );
    }
    if (e.kind === "done") {
      const m = e.mon ? e.mon + " " : "";
      const x = e.exp ?? EXP_PER_DONE;
      return tr(
        `${e.name} đã xong việc! ${m}+${x} EXP`,
        `${e.name} finished the job! ${m}+${x} EXP`,
      );
    }
    if (e.kind === "blocked") {
      return tr(
        `${e.name} đang chờ bạn trả lời!`,
        `${e.name} is waiting for your reply!`,
      );
    }
  }
  const t = String(e.text ?? "");
  if (isEn()) {
    let m;
    if ((m = t.match(/^(.+) của (.+) tiến hóa thành (.+)!$/))) return `${m[2]}'s ${m[1]} evolved into ${m[3]}!`;
    if ((m = t.match(/^(.+) của (.+) trở thành shiny!$/))) return `${m[2]}'s ${m[1]} turned shiny!`;
    if ((m = t.match(/^(.+) đã xong việc!(.*)$/))) return `${m[1]} finished the job!${m[2]}`;
    if ((m = t.match(/^(.+) đang chờ bạn trả lời!$/))) return `${m[1]} is waiting for your reply!`;
  } else {
    let m;
    if ((m = t.match(/^(.+)'s (\S+) evolved into (\S+)!$/))) return `${m[2]} của ${m[1]} tiến hóa thành ${m[3]}!`;
    if ((m = t.match(/^(.+)'s (\S+) turned shiny!$/))) return `${m[2]} của ${m[1]} trở thành shiny!`;
    if ((m = t.match(/^(.+) finished the job!(.*)$/))) return `${m[1]} đã xong việc!${m[2]}`;
    if ((m = t.match(/^(.+) is waiting for your reply!$/))) return `${m[1]} đang chờ bạn trả lời!`;
  }
  return t;
}
export function unreadCount() {
  return events().filter((e) => !e.read).length;
}
// Marks one event read (or unread with read = false).
export function markRead(id, read = true) {
  const list = events();
  if (!list.some((e) => e.id === id && Boolean(e.read) !== read)) return;
  setShared("pocket.events", list.map((e) => (e.id === id ? { ...e, read } : e)));
}
export function markAllRead() {
  const list = events();
  if (list.every((e) => e.read)) return;
  setShared("pocket.events", list.map((e) => (e.read ? e : { ...e, read: true })));
}
// Removes the events already read.
export function clearRead() {
  const list = events();
  const keep = list.filter((e) => !e.read);
  if (keep.length !== list.length) setShared("pocket.events", keep);
}
// Removes one event (right-click on the message box, role "dialog").
export function dismissEvent(id) {
  const list = events();
  const keep = list.filter((e) => e.id !== id);
  if (keep.length !== list.length) setShared("pocket.events", keep);
}

// 8-bit jingles (sounds/, made by chiptune.py) for what Herdr has no sound
// for: "evolve", "shiny". Quiet when settings turn sounds off.
export function jingle(name) {
  if (settings()?.sounds?.enabled === false) return;
  try { playSound(`${UI}/sounds/${name}.mp3`); } catch {}
}

// Watches agents for changes of status and turns them into events and EXP.
// Call it from ONE copy only (the dialog role) on every render: it keeps the
// last statuses on `memo` (an object the caller owns) and only writes shared
// state when something changed, so it can't loop.
// Trainer stats (the trainer card): shared "pocket.trainer" = { since, jobs,
// dex: { [dex]: true } } — when the journey started, jobs finished, every
// Pokémon that has been in the party.
export function trainer() {
  return shared("pocket.trainer") ?? { since: Date.now(), jobs: 0, dex: {} };
}
function noteTrainer(list, jobsDone) {
  const t = shared("pocket.trainer");
  const next = t ? { ...t, dex: { ...t.dex } } : {
    since: Math.min(Date.now(), ...events().map((e) => e.at)),
    jobs: events().filter((e) => e.kind === "done" || e.kind === "evolve" || e.kind === "shiny").length,
    dex: {},
  };
  let changed = !t || jobsDone > 0;
  next.jobs += jobsDone;
  for (const a of list) {
    if (!a.pane) continue;
    const d = monOf(a.pane);
    if (!next.dex[d]) { next.dex[d] = true; changed = true; }
  }
  if (changed) setShared("pocket.trainer", next);
}

export function trackAgents(memo) {
  const now = agentList();
  const first = !memo.seen;
  memo.seen = memo.seen ?? {};
  let jobsDone = 0;
  for (const a of now) {
    const was = memo.seen[a.address];
    memo.seen[a.address] = a.status;
    if (first || was === a.status) continue;
    const name = agentName(a);
    const mon = a.pane ? monNameOf(a.pane) : null;
    if (a.status === "done" || (a.status === "idle" && was === "working")) {
      const r = gainExp(a);
      jobsDone++;
      if (r.change) jingle(r.change.kind);
      if (r.change?.kind === "evolve") {
        const { from, to } = r.change;
        pushEvent(
          tr(`${monName(from)} của ${name} tiến hóa thành ${monName(to)}!`, `${name}'s ${monName(from)} evolved into ${monName(to)}!`),
          a.address, "evolve", { name, from, to },
        );
      } else if (r.change?.kind === "shiny") {
        const { from } = r.change;
        pushEvent(
          tr(`${monName(from)} của ${name} trở thành shiny!`, `${name}'s ${monName(from)} turned shiny!`),
          a.address, "shiny", { name, from },
        );
      } else {
        pushEvent(
          tr(`${name} đã xong việc! ${mon ? mon + " " : ""}+${EXP_PER_DONE} EXP`, `${name} finished the job! ${mon ? mon + " " : ""}+${EXP_PER_DONE} EXP`),
          a.address, "done", { name, mon, exp: EXP_PER_DONE },
        );
      }
    } else if (a.status === "blocked") {
      pushEvent(
        tr(`${name} đang chờ bạn trả lời!`, `${name} is waiting for your reply!`),
        a.address, "blocked", { name },
      );
    }
  }
  noteTrainer(now, jobsDone);
}

// The START menu and its screens (roles "menu", "trainer", "map", "inbox", "stamina").
export function openMenu() {
  openOverlay({ mod: "pocket", kind: "popup", frame: "none", width: 240, height: 330, props: { role: "menu" } });
}
export function openSidePane(role) {
  const all = panes();
  const here = spaces().flatMap((s) => s.tabs).find((t) => t.active)?.id;
  const roles = shared("pocket.pane.roles") ?? {};
  const found = all.find((p) => roles[p.pane] === role || (role === "stamina" && shared("pocket.stamina.pane") === p.pane));
  if (found) {
    if (found.tab === here) {
      if (found.focused) {
        run("pane.close", { pane: found.pane });
        return;
      }
      run("pane.focus", { pane: found.pane });
      return;
    }
    // If it was in another tab, close that one
    run("pane.close", { pane: found.pane });
  }

  // Find the active terminal or pane in this tab to split to its right
  const target = all.find((p) => p.tab === here && p.focused) ?? all.find((p) => p.tab === here && p.terminal) ?? all.find((p) => p.tab === here);
  setShared("pocket.pane.pending", {
    role,
    before: (panes() ?? []).filter((p) => p.mod === "pocket").map((p) => p.pane),
    at: Date.now(),
  });
  run("pane.split", {
    direction: "right",
    ...(target ? { pane: target.pane } : {}),
    mod: "pocket",
    props: { role },
  });
}
export function openStamina() {
  return openSidePane("stamina");
}
// The quest log (role "quest"): each town's to-do list, as a right side pane.
export function openQuest() {
  return openSidePane("quest");
}
// The bag (role "bag"): items that send a preset command to one agent.
export function openBag(address) {
  if (!address) return;
  openOverlay({ mod: "pocket", kind: "dialog", frame: "none", width: 520, height: 420, props: { role: "bag", address } });
}
export function openTrainer() {
  openOverlay({ mod: "pocket", kind: "dialog", frame: "none", width: 600, height: 380, props: { role: "trainer" } });
}
export function openInbox() {
  openOverlay({ mod: "pocket", kind: "dialog", frame: "none", width: 620, height: 0.75, props: { role: "inbox" } });
}
export function openMap() {
  openOverlay({ mod: "pocket", kind: "dialog", frame: "none", width: 0.8, height: 0.8, props: { role: "map" } });
}

// Notes: the layout column "notes", right of the panes, hidden until opened:
// a header (role "notes") over a terminal block that shows the core terminal
// named "pocket-notes" (Neovim on data/pocket/notes.md under Herdr's home). The
// block names the terminal, not its address, so the layout file never changes;
// ensureNotes() starts Neovim again whenever it isn't running.
export const NOTES_NAME = "pocket-notes";
// Neovim's start: clipboard=unnamed (plus unnamedplus, so a yank also reaches
// the system clipboard on Linux), no line numbers, status line or ruler, save on every change,
// re-read outside edits.
const NOTES_NVIM = [
  "set clipboard=unnamed,unnamedplus",
  "set nonumber norelativenumber",
  "set laststatus=0 noruler",
  "set autoread",
  "autocmd TextChanged,InsertLeave,FocusLost,BufLeave * silent! update",
  "autocmd FocusGained,BufEnter * silent! checktime",
];
export function notesPath() {
  return `${appHome()}/data/pocket/notes.md`;
}
export function notesTerminal() {
  return (terminals() ?? []).find((t) => t.name === NOTES_NAME && t.state === "live") ?? null;
}
let notesStarting = null; // one start at a time, shared by every copy
// Starts Neovim when it isn't running, and makes sure the layout has the block
// showing it: Herdr drops a terminal block from the layout (and rewrites the
// file) when its terminal ends, and a block keeps the terminal it found first.
export async function ensureNotes() {
  const live = notesTerminal();
  if (live) {
    if (!findNode(layout(), "notes-term")) setNotesBlock(true);
    return live.address;
  }
  if (!notesStarting) {
    notesStarting = startNotes().finally(() => {
      notesStarting = null;
    });
  }
  return notesStarting;
}
// The file Neovim edits: notes.md, or where it links to when it is a symlink
// (one step, so a path you chose stays as written; each computer can link it
// to its own file), with Neovim started in that file's folder.
async function notesFile() {
  const path = notesPath();
  try {
    const r = await exec("readlink", [path]);
    const target = r.code === 0 ? r.stdout.trim() : "";
    if (target) return target.startsWith("/") ? target : `${path.slice(0, path.lastIndexOf("/"))}/${target}`;
  } catch {}
  return path;
}
async function startNotes() {
  const file = await notesFile();
  const args = ["run", "--bg", "--json", "--no-parent", "--name", NOTES_NAME, "--cwd", file.slice(0, file.lastIndexOf("/")) || "/", "--", "nvim"];
  for (const c of NOTES_NVIM) args.push("-c", c);
  args.push(file);
  let address = null;
  try {
    address = JSON.parse((await hc(args)).stdout).address ?? null;
  } catch {}
  if (address) {
    // A fresh terminal: drop any old block first so the new one binds to it.
    if (findNode(layout(), "notes-term")) setNotesBlock(false);
    setNotesBlock(true);
  }
  return address;
}
// Adds (or removes) the "notes-term" block under the "notes" column.
function setNotesBlock(on) {
  const tree = JSON.parse(JSON.stringify(layout() ?? null));
  const notes = findNode(tree, "notes");
  if (!notes) return;
  notes.children = (notes.children ?? []).filter((c) => c.id !== "notes-term");
  if (on) notes.children.push({ id: "notes-term", type: "block", content: { terminal: NOTES_NAME } });
  // layout() reports what shows now; the file keeps the panel hidden (Alt+N
  // shows it), so put that back and show it again if it was showing.
  const wasShown = !notes.hidden;
  notes.hidden = true;
  run("layout.set", { layout: tree });
  if (wasShown) run("layout.show", { id: "notes" });
}
function findNode(n, id) {
  if (!n || typeof n !== "object") return null;
  if (n.id === id) return n;
  for (const c of n.children ?? []) {
    const f = findNode(c, id);
    if (f) return f;
  }
  return null;
}
// Whether Neovim runs and the layout shows it.
export function notesReady() {
  return Boolean(notesTerminal() && findNode(layout(), "notes-term"));
}
export function notesShown() {
  const n = findNode(layout(), "notes");
  return Boolean(n && !n.hidden);
}
// Whether the keyboard is in the notes terminal (a layout block: no pane).
// Herdr names a focused layout block by its id ("notes-term") as the pane, or
// gives no pane and the block's terminal (the name, or the address).
export function notesFocused() {
  const f = focused();
  if (!f) return false;
  if (f.pane === "notes-term") return true;
  const t = notesTerminal();
  return !f.pane && (f.terminal === NOTES_NAME || (t && f.terminal === t.address));
}
// Alt+N and the top bar's NOTES button: hidden -> show it and type in it;
// shown but elsewhere -> type in it; typing in it -> hide it, back to the pane.
export async function jumpNotes() {
  if (notesShown() && notesFocused()) {
    closeNotes();
    return;
  }
  const f = focused();
  if (f?.pane && panes().some((p) => p.pane === f.pane)) setShared("pocket.notes.back", f.pane);
  const address = await ensureNotes();
  run("layout.show", { id: "notes" });
  // The block shows the terminal by name, and pane.focus finds blocks by what
  // they show: the address alone is "no such pane".
  if (address) run("pane.focus", { terminal: NOTES_NAME });
}
export function closeNotes() {
  run("layout.hide", { id: "notes" });
  const back = shared("pocket.notes.back");
  if (back && panes().some((p) => p.pane === back)) run("pane.focus", { pane: back });
}

// Where we are: the shown space's name, as a place name.
export function placeName() {
  const s = spaces().find((x) => x.active);
  return (s?.name ?? "~").toUpperCase();
}

export { h_flex, v_flex };

syncZoom();
syncTheme();
