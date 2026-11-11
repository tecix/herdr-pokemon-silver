// Pocket git loot: reader of each town's git state.

import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { exec, spaces, panes, shared, setShared } from "herdr";
import { M, FONT_SMALL, SMALL, LH } from "./kit.js";

/**
 * Pure parser for git status porcelain v2 output with branch info.
 * @param {string} text
 * @returns {{ branch: string, ahead: number, behind: number, changed: number, untracked: number, upstream: boolean }}
 */
export function parseGitStatus(text) {
  let branch = "";
  let ahead = 0;
  let behind = 0;
  let changed = 0;
  let untracked = 0;
  let upstream = false;

  if (!text) {
    return { branch, ahead, behind, changed, untracked, upstream };
  }

  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith("# branch.head ")) {
      branch = line.slice("# branch.head ".length).trim();
    } else if (line.startsWith("# branch.upstream ")) {
      upstream = true;
    } else if (line.startsWith("# branch.ab ")) {
      upstream = true;
      const m = line.match(/^# branch\.ab \+(\d+) -(\d+)/);
      if (m) {
        ahead = parseInt(m[1], 10) || 0;
        behind = parseInt(m[2], 10) || 0;
      }
    } else if (line.startsWith("1 ") || line.startsWith("2 ") || line.startsWith("u ")) {
      changed++;
    } else if (line.startsWith("? ")) {
      untracked++;
    }
  }

  return { branch, ahead, behind, changed, untracked, upstream };
}

function lootDiffers(next, was) {
  const nextKeys = Object.keys(next);
  const wasKeys = Object.keys(was);
  if (nextKeys.length !== wasKeys.length) return true;
  for (const k of nextKeys) {
    const n = next[k];
    const w = was[k];
    if (!w) return true;
    if (
      n.branch !== w.branch ||
      n.ahead !== w.ahead ||
      n.behind !== w.behind ||
      n.changed !== w.changed ||
      n.untracked !== w.untracked ||
      n.upstream !== w.upstream
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Single loader copy started in dialog.js init.
 * Reads every town every 30 s and stores in shared("pocket.git").
 */
export function startGitLoot(cx) {
  cx.spawn(async (cx) => {
    for (;;) {
      try {
        const was = shared("pocket.git");
        const next = {};
        const allPanes = panes() ?? [];
        for (const s of spaces() ?? []) {
          try {
            const tabIds = new Set((s.tabs ?? []).map((t) => t.id));
            const p = allPanes.find((p) => p.terminal && p.cwd && tabIds.has(p.tab));
            const folder = p?.cwd || s.folder || null;
            if (!folder) continue;

            const opts = s.machine ? { on: s.machine, timeout: 5000 } : { timeout: 5000 };
            const res = await exec("git", ["-C", folder, "status", "--porcelain=v2", "--branch"], opts).catch(() => null);
            if (!res || res.code !== 0) continue;

            const parsed = parseGitStatus(res.stdout || "");
            next[s.id] = { ...parsed, at: Date.now() };
          } catch {}
        }
        if (!was || lootDiffers(next, was)) {
          setShared("pocket.git", next);
        }
      } catch (e) {
        console.log(`pocket gitloot: ${e?.message ?? e}`);
      }
      await new Promise((resolve) => cx.timer.after(30000, () => resolve()));
    }
  });
}

/**
 * Get git loot entry for a space.
 * @param {string} spaceId
 * @returns {object|null}
 */
export function gitLoot(spaceId) {
  if (!spaceId) return null;
  const all = shared("pocket.git");
  return all?.[spaceId] ?? null;
}

/**
 * Small chips in FONT_SMALL at `size`.
 * "✎N" changed (M.yellow) when N>0
 * "+N" untracked (M.overlay1) when >0
 * "↑N" ahead (M.green) when >0
 * "↓N" behind (M.peach) when >0
 * "✓" in M.green when clean and in sync
 * Gap 4, flex_none, no wrapping.
 * @param {string} spaceId
 * @param {number} [size]
 */
export function lootChips(spaceId, size = SMALL) {
  const sz = size ?? SMALL;
  const loot = gitLoot(spaceId);
  if (!loot) return null;

  const chips = [];
  const chip = (text, color) =>
    div()
      .flex_none()
      .whitespace_nowrap()
      .font_family(FONT_SMALL)
      .text_size(sz)
      .line_height(LH(sz))
      .text_color(color)
      .child(text);

  const clean = !loot.changed && !loot.untracked && !loot.ahead && !loot.behind;
  if (clean) {
    chips.push(chip("✓", M.green));
  } else {
    if (loot.changed > 0) chips.push(chip(`✎${loot.changed}`, M.yellow));
    if (loot.untracked > 0) chips.push(chip(`+${loot.untracked}`, M.overlay1));
    if (loot.ahead > 0) chips.push(chip(`↑${loot.ahead}`, M.green));
    if (loot.behind > 0) chips.push(chip(`↓${loot.behind}`, M.peach));
  }

  if (chips.length === 0) return null;

  return h_flex()
    .flex_none()
    .flex_nowrap()
    .gap(4)
    .items_center()
    .children(chips);
}
