// Pocket: which Pokémon each agent is, and its art. Nothing Pokémon ships with
// this mod: on first use the art is downloaded from PokeAPI's sprite repo into
// ~/.config/herdr-app/data/pocket/<dex>/ (same approach as
// mathieucroset/herdr-pokemon-agents) and pixel-doubled by pixel.py (Python +
// Pillow; without it the 1x files are used for both sizes).
//
// Shared state (every copy re-renders when it changes):
//   "pocket.mons" = { [pane id]: dex }      the pick per pane (survives restarts)
//   "pocket.shiny" = { [pane id]: true }    turned shiny (a full EXP bar with no
//                                          evolution left)
//   "pocket.art"  = { [key]: Art | "error" } what's on disk; key = monKey(pane):
//                                          "<dex>" or "<dex>s" (shiny)
//   "pocket.info" = { [terminal]: Info }    Claude Code's own session facts
//                                          (agent-info.py): name, state, model, effort
//   "pocket.screen" = { [terminal]: { model, effort } }  other agents' model,
//                                          read off their screen (screenFacts)
//   "pocket.hp" = { [machine]: { [program key]: { used, resets_at, at, windows } } }
//                                          5-hour usage (usage5h.py) = HP; windows =
//                                          [{ id: "5h"|"7d"|"month"|…, used, resets_at }]
//   "pocket.names" = { [pane id]: name }   a pane renamed from its header
// Art = { front, front2, anim, anim2, icon, icon2 }: paths for image(), relative to the
//   app home. front = Emerald front sprite (64px), anim = Emerald animated
//   one (GIF), *2 = pixel-doubled (128px), icon = the small menu icon (40x30), icon2 = it doubled (80x60).
//
// Only ONE copy runs the loader (the dialog role: startLoader(cx) in init).

import { exec, hc, appHome, agents, shared, setShared, spaces, panes, terminals } from "herdr";
import * as fs from "fs/promises";
import { NAMES } from "./names.js";

export { NAMES };
export const COUNT = 151;
const REL = "data/pocket";
const DATA = `${appHome()}/${REL}`;
const SPRITES = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
const EMERALD = `${SPRITES}/versions/generation-iii/emerald`;
const ICONS = `${SPRITES}/versions/generation-vii/icons`;
const PIXEL = `${appHome()}/mods/pocket/pixel.py`;
const BBOX = `${appHome()}/mods/pocket/bbox.py`;
const VERSION = 2;

export function monName(dex) {
  return (NAMES[dex - 1] ?? "MISSINGNO").toUpperCase();
}

function hash(s) {
  let h = 2166136261;
  for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}

// The dex number for a pane: its saved pick, else a stable hash (the loader
// saves one soon, skipping Pokémon already on screen).
export function monOf(pane) {
  const saved = shared("pocket.mons")?.[pane];
  return saved ?? (pane ? (hash(pane) % COUNT) + 1 : 25);
}

export function setMon(pane, dex) {
  setShared("pocket.mons", { ...(shared("pocket.mons") ?? {}), [pane]: dex });
  if (shared("pocket.shiny")?.[pane]) setShiny(pane, false);
}

export function shinyOf(pane) {
  return Boolean(shared("pocket.shiny")?.[pane]);
}
export function setShiny(pane, on) {
  const all = { ...(shared("pocket.shiny") ?? {}) };
  if (on) all[pane] = true;
  else delete all[pane];
  setShared("pocket.shiny", all);
}
// The art key for a pane: its dex, plus "s" when shiny.
export function monKey(pane) {
  return `${monOf(pane)}${shinyOf(pane) ? "s" : ""}`;
}
const parseKey = (key) => ({ dex: parseInt(key, 10), shiny: String(key).endsWith("s") });

// Gen 1 evolutions, within the first 151 (Eevee picks one of its three).
const EVOLVES = {
  1: 2, 2: 3, 4: 5, 5: 6, 7: 8, 8: 9, 10: 11, 11: 12, 13: 14, 14: 15, 16: 17, 17: 18,
  19: 20, 21: 22, 23: 24, 25: 26, 27: 28, 29: 30, 30: 31, 32: 33, 33: 34, 35: 36, 37: 38,
  39: 40, 41: 42, 43: 44, 44: 45, 46: 47, 48: 49, 50: 51, 52: 53, 54: 55, 56: 57, 58: 59,
  60: 61, 61: 62, 63: 64, 64: 65, 66: 67, 67: 68, 69: 70, 70: 71, 72: 73, 74: 75, 75: 76,
  77: 78, 79: 80, 81: 82, 84: 85, 86: 87, 88: 89, 90: 91, 92: 93, 93: 94, 96: 97, 98: 99,
  100: 101, 102: 103, 104: 105, 109: 110, 111: 112, 116: 117, 118: 119, 120: 121,
  129: 130, 133: [134, 135, 136], 138: 139, 140: 141, 147: 148, 148: 149,
};
// Where a dex stands in its line: 0 base (or no line), 1 middle, 2 final of three.
const EVOLVED_FROM = {};
for (const [from, to] of Object.entries(EVOLVES)) for (const t of [].concat(to)) EVOLVED_FROM[t] = Number(from);
export function stageOf(dex) {
  let n = 0;
  for (let d = EVOLVED_FROM[dex]; d && n < 3; d = EVOLVED_FROM[d]) n++;
  return n;
}
export function evolutionOf(dex, pane = "") {
  const e = EVOLVES[dex];
  return Array.isArray(e) ? e[hash(pane) % e.length] : e ?? null;
}

// Art for a key (monKey), or null while it isn't on disk yet (placeholder then).
export function artOf(key) {
  const a = shared("pocket.art")?.[key];
  return a && a !== "error" ? a : null;
}

async function curl(pairs) {
  const args = ["-sfL", "--retry", "2", "--connect-timeout", "10", "--parallel"];
  for (const [file, url] of pairs) args.push("-o", file, url);
  const r = await exec("curl", args, { timeout: 60000 });
  if (r.code !== 0) throw new Error(`download failed (curl ${r.code})`);
}

async function double(src, out) {
  const r = await exec("python3", [PIXEL, src, out, "2"]).catch(() => null);
  return r?.code === 0;
}

// Where each picture's visible pixels are (Art.box), so kit mon() can center
// the Pokémon itself rather than its image's empty margins.
// box = { front: [x0, y0, x1, y1, w, h], anim: [...], icon: [...] } in image px.
async function boxes(dir) {
  const files = ["front.png", "anim.gif", "icon.png"].map((n) => `${dir}/${n}`);
  const r = await exec("python3", [BBOX, ...files]).catch(() => null);
  if (r?.code !== 0) return null;
  const j = JSON.parse(r.stdout);
  return { front: j[files[0]], anim: j[files[1]], icon: j[files[2]] };
}

async function exists(p) {
  return fs.exists(p).catch(() => false);
}

// Downloads and prepares one Pokémon's art (cached on disk; meta.json last).
export async function ensureArt(key) {
  const { dex, shiny } = parseKey(key);
  const dir = `${DATA}/${key}`;
  const rel = `${REL}/${key}`;
  const sh = shiny ? "shiny/" : "";
  const metaFile = `${dir}/meta.json`;
  if (await exists(metaFile)) {
    try {
      const m = JSON.parse(await fs.readFile(metaFile, "utf8"));
      if (m.version === VERSION) {
        let dirty = false;
        if (!m.art.box) { m.art.box = (await boxes(dir)) ?? {}; dirty = true; }
        if (!m.art.icon2) {
          m.art.icon2 = (await double(`${dir}/icon.png`, `${dir}/icon2.png`)) ? `${rel}/icon2.png` : m.art.icon;
          dirty = true;
        }
        if (!m.art.version) { m.art.version = VERSION; dirty = true; }
        if (dirty) await fs.writeFile(metaFile, JSON.stringify(m));
        return m.art;
      }
    } catch {}
  }
  await fs.mkdir(dir, { recursive: true });
  const animRaw = `${dir}/anim_raw.png`;
  try {
    await curl([
      [`${dir}/front.png`, `${EMERALD}/${sh}${dex}.png`],
      [animRaw, `${EMERALD}/animated/${sh}${dex}.png`],
      [`${dir}/icon.png`, `${ICONS}/${dex}.png`],
    ]);
    const r = await exec("python3", [PIXEL, animRaw, `${dir}/anim.gif`, "1"]);
    if (r.code !== 0) throw new Error(`anim convert failed: ${r.stderr || r.code}`);
  } finally {
    await fs.unlink(animRaw).catch(() => {});
  }
  const art = { version: VERSION, front: `${rel}/front.png`, anim: `${rel}/anim.gif`, icon: `${rel}/icon.png`, front2: `${rel}/front.png`, anim2: `${rel}/anim.gif` };
  if (await double(`${dir}/front.png`, `${dir}/front2.png`)) art.front2 = `${rel}/front2.png`;
  if (await double(`${dir}/anim.gif`, `${dir}/anim2.gif`)) art.anim2 = `${rel}/anim2.gif`;
  art.icon2 = (await double(`${dir}/icon.png`, `${dir}/icon2.png`)) ? `${rel}/icon2.png` : art.icon;
  art.box = (await boxes(dir)) ?? {};
  await fs.writeFile(metaFile, JSON.stringify({ version: VERSION, art }));
  return art;
}

// Menu icons for all 151 (the picker), one download. Resolves when ready.
export async function ensureIcons() {
  const marker = `${DATA}/icons/ready`;
  if (await exists(marker)) return;
  await fs.mkdir(`${DATA}/icons`, { recursive: true });
  const pairs = [];
  for (let d = 1; d <= COUNT; d++) pairs.push([`${DATA}/icons/${d}.png`, `${ICONS}/${d}.png`]);
  await curl(pairs);
  await fs.writeFile(marker, String(Date.now()));
}
export const iconPath = (dex) => `${REL}/icons/${dex}.png`;

// ---- Walking art (the field strip): PMD SpriteCollab sheets, cut per facing
// into GIFs by pmd.py — the same art and cuts as
// mathieucroset/herdr-pokemon-agents (MIT), with Pillow instead of ImageMagick.
// shared "pocket.walk" = { [dex]: Walk | "error" }
// Walk = { scale, walkR, walkL, idleR, idleL, sleep }, each { path, w, h, box }
// (path for image(); box = where its visible pixels are, feet = box bottom).
const PMD = "https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite";
const PMD_CUT = `${appHome()}/mods/pocket/pmd.py`;
const WALK_VERSION = 1;
// PMD rows: 0 down, 1 down-right, 2 right, 6 left, 7 down-left.
const CUTS = [["walkR", "Walk", 2], ["walkL", "Walk", 6], ["idleR", "Idle", 1], ["idleL", "Idle", 7], ["sleep", "Sleep", 0]];

function parseAnims(xml) {
  const anims = {};
  for (const m of xml.matchAll(/<Anim>([\s\S]*?)<\/Anim>/g)) {
    const body = m[1];
    const get = (tag) => body.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1];
    const name = get("Name");
    if (!name) continue;
    anims[name] = {
      name,
      copyOf: get("CopyOf") ?? null,
      fw: Number(get("FrameWidth")),
      fh: Number(get("FrameHeight")),
      durations: [...body.matchAll(/<Duration>(\d+)<\/Duration>/g)].map((d) => Number(d[1])),
    };
  }
  return anims;
}
function resolveAnim(anims, name) {
  let a = anims[name];
  for (let hops = 0; a?.copyOf && hops < 4; hops++) a = anims[a.copyOf];
  return a && a.fw > 0 && a.fh > 0 ? a : null;
}

export function walkOf(key) {
  const w = shared("pocket.walk")?.[key];
  return w && w !== "error" ? w : null;
}

export async function ensureWalk(key) {
  const { dex, shiny } = parseKey(key);
  const pad = String(dex).padStart(4, "0");
  const dir = `${DATA}/${key}/walk`;
  const rel = `${REL}/${key}/walk`;
  const metaFile = `${dir}/meta.json`;
  if (await exists(metaFile)) {
    try {
      const m = JSON.parse(await fs.readFile(metaFile, "utf8"));
      if (m.version === WALK_VERSION) return m;
    } catch {}
  }
  await fs.mkdir(dir, { recursive: true });
  // PMD keeps a shiny form under <dex>/0000/0001/.
  const base = shiny ? `${PMD}/${pad}/0000/0001` : `${PMD}/${pad}`;
  await curl([[`${dir}/AnimData.xml`, `${base}/AnimData.xml`]]);
  const anims = parseAnims(await fs.readFile(`${dir}/AnimData.xml`, "utf8"));
  const walk = resolveAnim(anims, "Walk");
  if (!walk) throw new Error("no walking animation");
  const pick = { Walk: walk, Idle: resolveAnim(anims, "Idle") ?? walk };
  pick.Sleep = resolveAnim(anims, "Sleep") ?? pick.Idle;
  const sheets = [...new Set(Object.values(pick).map((a) => a.name))];
  await curl(sheets.map((n) => [`${dir}/${n}.png`, `${base}/${n}-Anim.png`]));
  // Big Pokémon (Onix, Gyarados...) have big frames: draw those at 1x.
  const scale = walk.fh > 64 ? 1 : 2;
  const meta = { version: WALK_VERSION, dex, scale };
  for (const [key, which, row] of CUTS) {
    const a = pick[which];
    const out = `${dir}/${key}.gif`;
    const r = await exec("python3", [PMD_CUT, `${dir}/${a.name}.png`, String(a.fw), String(a.fh), String(row), a.durations.join(","), String(scale), out]);
    if (r.code !== 0) throw new Error(r.stderr.trim() || "pmd.py failed");
    meta[key] = { path: `${rel}/${key}.gif`, ...JSON.parse(r.stdout) };
  }
  await fs.writeFile(metaFile, JSON.stringify(meta));
  return meta;
}

// Agents, including panes that run a known agent program but don't report a
// status to Herdr (then agents() leaves them out: e.g. a Claude Code started
// without Herdr's status hook). Those get status "idle" (or the core's word if
// it is one of Herdr's) and the same fields as agents() entries.
const AGENT_KEYS = ["claude", "codex", "opencode", "gemini", "antigravity", "cursor", "copilot", "amp", "pi", "grok", "kimi", "kiro", "crush", "hermes", "qoder", "dsh-tui", "pig"];
export function infoOf(address) {
  return shared("pocket.info")?.[address] ?? null;
}
export function agentList() {
  const info = shared("pocket.info") ?? {};
  const scr = shared("pocket.screen") ?? {};
  const facts = (address) => {
    const i = info[address];
    const f = scr[address];
    return { session_name: i?.name ?? null, model: i?.model ?? f?.model ?? null, effort: i?.model ? i.effort ?? null : f?.effort ?? null };
  };
  const list = agents().map((a) => ({ ...a, ...facts(a.address) }));
  const seen = new Set(list.map((a) => a.pane));
  const where = new Map(spaces().flatMap((s) => s.tabs.map((t) => [t.id, { s, t }])));
  const core = new Map((terminals() ?? []).map((t) => [t.address, t]));
  for (const p of panes()) {
    if (!p.terminal || seen.has(p.pane)) continue;
    if (!(p.program?.agent || AGENT_KEYS.includes(p.program?.key))) continue;
    const w = where.get(p.tab);
    const i = info[p.terminal];
    const st = i?.state ?? core.get(p.terminal)?.status;
    list.push({
      address: p.terminal, pane: p.pane, space: w?.s.id, space_name: w?.s.name ?? "",
      tab: p.tab, tab_index: w?.t.index ?? 0, tab_name: w?.t.name ?? "",
      status: ["working", "blocked", "done", "idle"].includes(st) && st !== "done" ? st : "idle",
      app: p.program?.key ?? null, program: p.program, title: p.title, seq: 0,
      pinned: false, focused: p.focused, synthetic: true,
      ...facts(p.terminal),
    });
  }
  return list;
}

// Model and effort of agents that keep them only on screen (read with
// `hc read`, works for other machines too). shared "pocket.screen" =
// { [terminal]: { model, effort } }. What each one shows at the bottom:
//   OpenCode     "┃  Build · Kimi K3.1 Pro OpenCode Go · high" (mode · model provider · effort;
//                or "model account / provider")
//   Antigravity  "                    Gemini 3.8 Flash · medium" (right-aligned, last line)
//   Codex        "gpt-5.5 high · 97% context left · ~/dir"
//   Gemini CLI   "gemini-2.5-pro (98% context left)"
const SCREEN_KEYS = ["opencode", "antigravity", "codex", "gemini"];
const EFFORTS = "minimal|none|low|medium|high|xhigh|max";
const PROVIDERS = /\s+(OpenCode Go|OpenCode Zen|OpenCode|Anthropic|OpenAI|Google Vertex|Google|GitHub Copilot|OpenRouter|xAI|Groq|DeepSeek|Moonshot AI|Z\.AI|Zhipu AI|Amazon Bedrock|Azure|Vercel AI Gateway|Vercel|Ollama|LM Studio|Mistral|Cerebras|Fireworks AI|Together AI)$/i;
export function screenFacts(key, text) {
  const lines = String(text).split("\n").map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim());
  const bottom = lines.slice(-8).reverse();
  const effortOf = (e) => (e && e !== "none" ? e.toLowerCase() : null);
  if (key === "opencode") {
    for (const l of bottom) {
      const m = l.match(new RegExp(`^\\s*┃\\s+[^·┃]+?\\s·\\s(.+?)(?:\\s·\\s(${EFFORTS}))?$`, "i"));
      if (!m) continue;
      // "<model> <provider>", or "<model> <account> / <provider>".
      let model = m[1].trim();
      if (model.includes(" / ")) model = model.slice(0, model.lastIndexOf(" / ")).replace(/\s+\S+$/, "");
      return { model: model.replace(PROVIDERS, "").trim(), effort: effortOf(m[2]) };
    }
  } else if (key === "antigravity") {
    for (const l of bottom.slice(0, 4)) {
      const m = l.match(new RegExp(`(?:^\\s{8,}|\\s{4,})((?:Gemini|Claude|GPT|o\\d)\\b[^·]*?|\\S[^·]*?\\d[^·]*?)(?:\\s·\\s(${EFFORTS}))?$`, "i"));
      if (m) return { model: m[1].trim(), effort: effortOf(m[2]) };
    }
  } else if (key === "codex") {
    for (const l of bottom) {
      const m = l.match(new RegExp(`\\b((?:gpt|o\\d|codex)[\\w.-]*)(?:\\s+(${EFFORTS}))?\\s+·`, "i"));
      if (m) return { model: m[1], effort: effortOf(m[2]) };
    }
  } else if (key === "gemini") {
    for (const l of bottom) {
      const m = l.match(/\b(gemini-[\w.-]+)/i);
      if (m) return { model: m[1], effort: null };
    }
  }
  return null;
}

// The loader: saves a pick for every agent's pane (no duplicates on screen) and
// fetches the art they need. Every 1.5 s; failures retry after a minute.
const INFO = `${appHome()}/mods/pocket/agent-info.py`;
const USAGE = `${appHome()}/mods/pocket/usage5h.py`;
const OPENCODE_QUOTA = `${appHome()}/mods/over9k-usage/opencode-quota.py`;
const AGY_STATUS = `${appHome()}/mods/pocket/agy-statusline.sh`;
const AGY_TITLE = `${appHome()}/mods/pocket/agy-title.sh`;
// A usage window's id from its name: "5h", "5-hour", "five_hour" -> "5h";
// "5h:Gemini" -> "5h:Gemini", "5h:Other" / "5h 3rd party" -> "5h:Other";
// "7d", "Weekly (all models)" -> "7d"; "Weekly (Opus)" -> "7d:Opus";
// "Month" -> "month"; anything else stays as it is.
export function windowId(name) {
  const n = String(name ?? "").trim();
  const colon = n.indexOf(":");
  const head = colon >= 0 ? n.slice(0, colon).trim() : n;
  let extra = colon >= 0 ? n.slice(colon + 1).trim() : (n.match(/\(([^)]*)\)/)?.[1] ?? "").trim();
  if (!extra && /\b(3rd[- ]?party|claude|gpt)\b/i.test(n)) extra = "Other";
  if (!extra && /\bargon\b/i.test(n)) extra = "Argon";
  if (/^(3p|3rd[- ]?party|other)$/i.test(extra)) extra = "Other";
  else if (/^gemini$/i.test(extra)) extra = "Gemini";
  else if (/^argon/i.test(extra)) extra = "Argon";
  const tail = extra && !/^all\b/i.test(extra) ? ":" + extra : "";
  if (/^(5[- ]?h|five)/i.test(head)) return "5h" + tail;
  if (/^(7[- ]?d|seven|week)/i.test(head)) return "7d" + tail;
  if (/^month/i.test(head)) return "month" + tail;
  return n;
}
// One product's new usage over the last one seen: an idle Claude session can
// write an older, lower number for the same window, so within one window
// (reset times under 5 min apart) the highest use seen is kept.
const sameWindow = (a, b) => a && b && a.resets_at && b.resets_at && Math.abs(a.resets_at - b.resets_at) < 300;
function keepHighest(old, v) {
  if (!old || !v) return v;
  const next = { ...v, ...(v.plan || !old.plan ? {} : { plan: old.plan }) };
  if (sameWindow(old, v) && Number(old.used) > Number(v.used)) next.used = old.used;
  if (Array.isArray(v.windows)) {
    next.windows = v.windows.map((w) => {
      const o = (old.windows ?? []).find((x) => x.id === w.id);
      return sameWindow(o, w) && Number(o.used) > Number(w.used) ? { ...w, used: o.used } : w;
    });
  }
  return next;
}

export function startLoader(cx) {
  const failedAt = {};
  // Ensure Antigravity CLI's statusLine/title helper points to Pocket's persistent tracker.
  cx.spawn(async () => {
    try {
      await exec("sh", ["-c", `
        ad="$HOME/.gemini/antigravity-cli"
        as="$ad/settings.json"
        [ -d "$ad" ] && command -v jq >/dev/null 2>&1 || exit 0
        [ -s "$as" ] || echo '{}' > "$as"
        cur=$(jq -r '.statusLine.command // ""' "$as" 2>/dev/null)
        case "$cur" in
          ""|*agy-statusline.sh*)
            jq --arg s "sh \\"${AGY_STATUS}\\"" --arg t "sh \\"${AGY_TITLE}\\"" \
              '.statusLine = {type: "command", command: $s, stack_with_default: true} | .title = {type: "command", command: $t}' \
              "$as" > "$as.tmp" && mv "$as.tmp" "$as" || rm -f "$as.tmp"
            ;;
        esac
      `]).catch(() => null);
    } catch {}
  });
  // HP: each machine's 5-hour & weekly usage per product, every minute (usage5h.py,
  // plus over9k-usage's opencode-quota.py where OpenCode runs).
  cx.spawn(async (cx) => {
    for (;;) {
      try {
        const script = await fs.readFile(USAGE, "utf8").catch(() => null);
        const oc = await fs.readFile(OPENCODE_QUOTA, "utf8").catch(() => null);
        const was = shared("pocket.hp") ?? {};
        const next = {};
        const byMachine = new Map([["", new Set()]]);
        for (const s of spaces()) {
          const m = s.machine ?? "";
          if (!byMachine.has(m)) byMachine.set(m, new Set());
        }
        for (const a of agentList()) {
          const m = a.address?.includes("/") ? a.address.split("/")[0] : "";
          if (!byMachine.has(m)) byMachine.set(m, new Set());
          if (a.program?.key) byMachine.get(m).add(a.program.key);
        }
        for (const [m, keys] of byMachine) {
          const on = m ? { on: m, timeout: 20000 } : { timeout: 20000 };
          const got = { ...(was[m] ?? {}) };
          if (script) {
            const r = await exec("python3", ["-c", script], on).catch(() => null);
            try {
              // An idle Claude session can write an older, lower number for the
              // same window: within one window keep the highest use seen.
              for (const [k, v] of Object.entries(JSON.parse(r?.stdout || "{}"))) got[k] = keepHighest(got[k], v);
            } catch {}
          }
          if (oc && (keys.has("opencode") || m === "")) {
            const r = await exec("python3", ["-c", oc], on).catch(() => null);
            try {
              const q = JSON.parse(r?.stdout || "null");
              const all = [...(q?.current?.limits ?? []), ...(q?.go?.limits ?? [])].filter((x) => x?.label && x.used != null);
              const windows = [];
              for (const x of all) {
                const id = windowId(x.label);
                const had = windows.find((w) => w.id === id);
                if (!had) windows.push({ id, used: x.used, resets_at: x.resets_at ?? null });
                else if (Number(x.used) > Number(had.used)) had.used = x.used;
              }
              const five = windows.find((w) => w.id === "5h");
              const plan = q?.go?.plan ?? q?.current?.plan ?? null;
              if (windows.length) {
                got.opencode = keepHighest(got.opencode, {
                  ...(five ? { used: five.used, resets_at: five.resets_at } : {}),
                  ...(plan ? { plan } : {}),
                  at: Math.round(Date.now() / 1000), windows,
                });
              }
            } catch {}
          }
          next[m] = got;
        }
        if (JSON.stringify(next) !== JSON.stringify(was)) setShared("pocket.hp", next);
      } catch (e) {
        console.log(`pocket hp: ${e?.message ?? e}`);
      }
      await new Promise((resolve) => cx.timer.after(60000, () => resolve()));
    }
  });
  // Claude Code's own session facts, every 3 s (shared only when they change).
  cx.spawn(async (cx) => {
    let last = JSON.stringify(shared("pocket.info") ?? {});
    for (;;) {
      try {
        const r = await exec("python3", [INFO], { timeout: 15000 });
        if (r.code === 0) {
          const text = JSON.stringify(JSON.parse(r.stdout || "{}"));
          if (text !== last) {
            last = text;
            setShared("pocket.info", JSON.parse(text));
          }
        }
      } catch (e) {
        console.log(`pocket info: ${e?.message ?? e}`);
      }
      await new Promise((resolve) => cx.timer.after(3000, () => resolve()));
    }
  });
  // Other agents' model and effort, from their screen, every 5 s. A screen
  // that doesn't show it right now (a menu is open) keeps the last answer.
  cx.spawn(async (cx) => {
    for (;;) {
      try {
        const info = shared("pocket.info") ?? {};
        const was = shared("pocket.screen") ?? {};
        const next = {};
        for (const a of agentList()) {
          if (!SCREEN_KEYS.includes(a.program?.key) || info[a.address]?.model) continue;
          const r = await hc(["read", a.address, "--json"]).catch(() => null);
          const f = r?.code === 0 ? screenFacts(a.program.key, JSON.parse(r.stdout || "{}").text ?? "") : null;
          if (f?.model) next[a.address] = f;
          else if (was[a.address]) next[a.address] = was[a.address];
        }
        if (JSON.stringify(next) !== JSON.stringify(was)) setShared("pocket.screen", next);
      } catch (e) {
        console.log(`pocket screen: ${e?.message ?? e}`);
      }
      await new Promise((resolve) => cx.timer.after(5000, () => resolve()));
    }
  });
  cx.spawn(async (cx) => {
    for (;;) {
      try {
        const saved = { ...(shared("pocket.mons") ?? {}) };
        let changed = false;
        const used = new Set();
        for (const a of agentList()) if (a.pane && saved[a.pane]) used.add(saved[a.pane]);
        for (const a of agentList()) {
          if (!a.pane || saved[a.pane]) continue;
          let d = (hash(a.pane) % COUNT) + 1;
          for (let i = 0; i < COUNT && used.has(d); i++) d = (d % COUNT) + 1;
          saved[a.pane] = d;
          used.add(d);
          changed = true;
        }
        if (changed) {
          const keys = Object.keys(saved);
          for (const k of keys.slice(0, Math.max(0, keys.length - 300))) delete saved[k];
          setShared("pocket.mons", saved);
        }
        const shiny = shared("pocket.shiny") ?? {};
        const need = new Set(agentList().filter((a) => a.pane && saved[a.pane]).map((a) => `${saved[a.pane]}${shiny[a.pane] ? "s" : ""}`));
        for (const d of Object.values(shared("pocket.extra") ?? {})) need.add(d);
        for (const d of need) {
          const art = shared("pocket.art")?.[d];
          if (art && art !== "error" && art.version === VERSION && art.box && art.icon2) continue;
          if (art === "error" && Date.now() - (failedAt[d] ?? 0) < 60000) continue;
          let next;
          try {
            next = await ensureArt(d);
          } catch (e) {
            failedAt[d] = Date.now();
            next = "error";
            console.log(`pocket: art for #${d}: ${e?.message ?? e}`);
          }
          setShared("pocket.art", { ...(shared("pocket.art") ?? {}), [d]: next });
        }
        for (const d of need) {
          const w = shared("pocket.walk")?.[d];
          if (w && (w !== "error" || Date.now() - (failedAt["w" + d] ?? 0) < 60000)) continue;
          let next;
          try {
            next = await ensureWalk(d);
          } catch (e) {
            failedAt["w" + d] = Date.now();
            next = "error";
            console.log(`pocket: walk for #${d}: ${e?.message ?? e}`);
          }
          setShared("pocket.walk", { ...(shared("pocket.walk") ?? {}), [d]: next });
        }
      } catch (e) {
        console.log(`pocket loader: ${e?.message ?? e}`);
      }
      await new Promise((resolve) => cx.timer.after(1500, () => resolve()));
    }
  });
}
