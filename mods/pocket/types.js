// Pocket island types: every island (machine; "" = this computer) has a
// Pokémon type, shown as a small icon beside its towns (spaces): the town map
// (sidebar and overlay), the agent cards, the town card and the top bar.
//
// The icons are JWNutz's "Pokemon icons" sheet
// (deviantart.com/jwnutz/art/Pokemon-icons-669595851). Like the Pokémon art,
// nothing ships with the mod: on first use the sheet is downloaded into
// data/pocket/types/ and typecut.py (Pillow) cuts the 18 type icons out of it.
// Until then, or without Pillow, a type shows as a small square in its color.
//
// Shared state:
//   "pocket.islands"     = { [machine]: type key }  each island's type; a new
//                          island gets one from its name, one no other island
//                          has while any are left. Change it on the town map
//                          (click the type, or T).
//   "pocket.types.icons" = "ready" | "error"         the cut icons are on disk
//   "pocket.host"        = this computer's host name (its island's name)
//
// Only ONE copy keeps these (the dialog role: startTypes(cx) in init).

import { div, image } from "gpui-kit";
import { exec, appHome, shared, setShared, machines, spaces } from "herdr";
import * as fs from "fs/promises";
import { isEn } from "./kit.js";

// The 18 types, in the sheet's order, with the sheet's colors.
export const TYPES = [
  { key: "grass", vi: "CỎ", en: "GRASS", color: "#5ec663" },
  { key: "fire", vi: "LỬA", en: "FIRE", color: "#f39263" },
  { key: "water", vi: "NƯỚC", en: "WATER", color: "#35c2ff" },
  { key: "electric", vi: "ĐIỆN", en: "ELECTRIC", color: "#fff542" },
  { key: "ice", vi: "BĂNG", en: "ICE", color: "#99d9ea" },
  { key: "rock", vi: "ĐÁ", en: "ROCK", color: "#b97a57" },
  { key: "ground", vi: "ĐẤT", en: "GROUND", color: "#e2cf74" },
  { key: "steel", vi: "THÉP", en: "STEEL", color: "#afafaf" },
  { key: "fighting", vi: "GIÁC ĐẤU", en: "FIGHTING", color: "#c85959" },
  { key: "dark", vi: "BÓNG TỐI", en: "DARK", color: "#68555a" },
  { key: "ghost", vi: "MA", en: "GHOST", color: "#846b98" },
  { key: "psychic", vi: "SIÊU LINH", en: "PSYCHIC", color: "#df80d3" },
  { key: "fairy", vi: "TIÊN", en: "FAIRY", color: "#ffaec9" },
  { key: "dragon", vi: "RỒNG", en: "DRAGON", color: "#6871d7" },
  { key: "bug", vi: "BỌ", en: "BUG", color: "#b9ea53" },
  { key: "poison", vi: "ĐỘC", en: "POISON", color: "#bf71bf" },
  { key: "flying", vi: "BAY", en: "FLYING", color: "#b4b1e4" },
  { key: "normal", vi: "THƯỜNG", en: "NORMAL", color: "#c3c3c3" },
];
const BY_KEY = Object.fromEntries(TYPES.map((t) => [t.key, t]));

const SHEET = "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/078761fc-b360-438b-a1a3-133f6c5f5540/db2nrgr-f2e1e71b-1005-4eec-a194-5dd8c6aaaed9.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiIvZi8wNzg3NjFmYy1iMzYwLTQzOGItYTFhMy0xMzNmNmM1ZjU1NDAvZGIybnJnci1mMmUxZTcxYi0xMDA1LTRlZWMtYTE5NC01ZGQ4YzZhYWFlZDkucG5nIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.VT62pr91m6pZeysACRQYzT77qi_WgbG3XwugwxTUBok";
const REL = "data/pocket/types";
const DIR = `${appHome()}/${REL}`;
const CUT = `${appHome()}/mods/pocket/typecut.py`;

export function typeInfo(key) {
  return BY_KEY[key] ?? BY_KEY.normal;
}
export function typeName(key) {
  const t = typeInfo(key);
  return isEn() ? t.en : t.vi;
}

// The island a space or agent is on ("" = this computer).
export function machineOfSpace(spaceId) {
  return (spaces() ?? []).find((s) => s.id === spaceId)?.machine ?? "";
}
export function machineOfAgent(a) {
  if (a?.space) {
    const s = (spaces() ?? []).find((x) => x.id === a.space);
    if (s) return s.machine ?? "";
  }
  return a?.address?.includes("/") ? a.address.split("/")[0] : "";
}
// An island's name: the machine's, or this computer's host name.
export function islandName(machine) {
  return machine || shared("pocket.host") || "";
}

function hash(s) {
  let h = 2166136261;
  for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}
// The type an island would get from its name alone.
function preferred(machine) {
  return TYPES[hash(islandName(machine) || "home") % TYPES.length].key;
}
export function islandType(machine) {
  return shared("pocket.islands")?.[machine ?? ""] ?? preferred(machine ?? "");
}
export function setIslandType(machine, key) {
  if (!BY_KEY[key]) return;
  setShared("pocket.islands", { ...(shared("pocket.islands") ?? {}), [machine ?? ""]: key });
}
// The next (or previous, dir -1) type for an island, on the town map.
export function cycleIslandType(machine, dir = 1) {
  const i = TYPES.findIndex((t) => t.key === islandType(machine));
  setIslandType(machine, TYPES[(i + dir + TYPES.length) % TYPES.length].key);
}

// Gives every known island without a type one: its name's, or the next one in
// order that no island has yet (while any are left).
function syncIslands() {
  const saved = shared("pocket.islands") ?? {};
  const known = new Set(["", ...(machines() ?? []).map((m) => m?.name ?? ""), ...(spaces() ?? []).map((s) => s?.machine ?? "")]);
  const used = new Set(Object.values(saved));
  const next = { ...saved };
  let changed = false;
  for (const m of [...known].sort()) {
    if (next[m]) continue;
    let i = TYPES.findIndex((t) => t.key === preferred(m));
    for (let n = 0; n < TYPES.length && used.has(TYPES[i].key); n++) i = (i + 1) % TYPES.length;
    next[m] = TYPES[i].key;
    used.add(next[m]);
    changed = true;
  }
  if (changed) setShared("pocket.islands", next);
}

async function exists(p) {
  return fs.exists(p).catch(() => false);
}
// Downloads the sheet and cuts the icons, once (kept on disk).
async function ensureIcons() {
  const all = await Promise.all(TYPES.map((t) => exists(`${DIR}/${t.key}2.png`)));
  if (all.every(Boolean)) return true;
  await fs.mkdir(DIR, { recursive: true });
  const sheet = `${DIR}/sheet.png`;
  if (!(await exists(sheet))) {
    const r = await exec("curl", ["-sfL", "--retry", "2", "--connect-timeout", "10", "-o", `${sheet}.part`, SHEET], { timeout: 60000 }).catch(() => null);
    if (r?.code !== 0) return false;
    await exec("mv", [`${sheet}.part`, sheet]);
  }
  const r = await exec("python3", [CUT, sheet, DIR], { timeout: 60000 }).catch(() => null);
  return r?.code === 0 && (await exists(`${DIR}/normal2.png`));
}

export function startTypes(cx) {
  let lastTry = 0;
  cx.spawn(async (cx) => {
    if (!shared("pocket.host")) {
      const r = await exec("hostname", []).catch(() => null);
      const h = r?.code === 0 ? r.stdout.trim() : "";
      if (h) setShared("pocket.host", h);
    }
    for (;;) {
      syncIslands();
      if (shared("pocket.types.icons") !== "ready") {
        // A failed try waits 30 minutes before the next.
        if (Date.now() - lastTry > 30 * 60000) {
          lastTry = Date.now();
          const ok = await ensureIcons().catch(() => false);
          setShared("pocket.types.icons", ok ? "ready" : "error");
        }
      }
      await cx.sleep(10000);
    }
  });
}

// A type's icon, `size` px square. A square in the type's color until the
// icons are on disk (a picture that failed to load stays failed until Herdr
// restarts, so none is asked for before then).
export function typeIcon(key, size = 12) {
  const t = typeInfo(key);
  if (shared("pocket.types.icons") === "ready") {
    return image(`${REL}/${t.key}${size > 32 ? "2" : ""}.png`).size(size).w(size).h(size).flex_none();
  }
  const dot = Math.max(4, Math.round(size * 0.6));
  return div().w(size).h(size).flex_none().flex().items_center().justify_center()
    .child(div().w(dot).h(dot).rounded(2).bg(t.color));
}
export function islandTypeIcon(machine, size = 12) {
  return typeIcon(islandType(machine), size);
}
