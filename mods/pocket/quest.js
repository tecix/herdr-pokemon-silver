// Pocket role "quest": QUEST LOG overlay (each town's to-do list).
import { div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { props, closeOverlay, spaces, machines, panes, exec, shared, setShared, run } from "herdr";
import {
  frame, cursor, glyph, M, INK, DARK, PAPER, TEXT, SMALL, BIG,
  FONT, FONT_SMALL, FONT_BIG, LH, tr,
} from "./kit.js";

function getTowns() {
  const all = spaces() ?? [];
  const groups = new Map();
  for (const m of machines() ?? []) groups.set(m.name ?? "", []);
  if (!groups.has("")) groups.set("", []);
  for (const s of all) {
    const k = s.machine ?? "";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(s);
  }
  const keys = [...groups.keys()].sort((a, b) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)));
  return keys.flatMap((k) => groups.get(k));
}

function getExecOpts(s) {
  const opts = { timeout: 10000 };
  if (!s) return opts;
  const tabIds = new Set((s.tabs ?? []).map((t) => (t && typeof t === "object" ? t.id : t)).filter(Boolean));
  const termPane = (panes() ?? []).find((p) => p.terminal && p.cwd && tabIds.has(p.tab));
  const folder = termPane?.cwd || s.folder || null;
  if (folder) opts.cwd = folder;
  if (s.machine != null && s.machine !== "") opts.on = s.machine;
  return opts;
}

export default class Role {
  init(props, cx) {
    this.pane = props?.pane ?? null;
    const towns = getTowns();
    const activeIdx = towns.findIndex((s) => s.active);
    this.at = activeIdx >= 0 ? activeIdx : 0;
    this.selected = 0;
    this.items = null;
    this.error = false;
    this.typing = false;
    this.seq = 0;
    this.savedCx = cx;

    this.focus = cx.focus_handle();
    cx.timer.after(0, () => this.focus.focus());

    this.input = InputState.new({ placeholder: tr("Thêm nhiệm vụ…", "Add a quest…") });
    this.input.on("focus", () => {
      this.typing = true;
    });
    this.input.on("blur", () => {
      this.typing = false;
    });
    this.input.on("submit", (_e, cx) => {
      this.add(cx);
    });

    this.load(cx);
    cx.timer.every(5000, (cx) => {
      this.load(cx);
    });
  }

  load(cx) {
    const towns = getTowns();
    const town = towns[this.at];
    if (!town) {
      this.items = [];
      this.error = false;
      cx?.notify?.();
      return;
    }
    const opts = getExecOpts(town);
    const seq = ++this.seq;
    const runner = cx?.spawn ? cx : this.savedCx;
    runner?.spawn?.(async (cx) => {
      try {
        const res = await exec("todo", [], opts);
        if (seq !== this.seq) return;
        const lines = (res?.stdout ?? "").split("\n");
        const parsed = [];
        for (const line of lines) {
          const m = line.match(/^\s*(\d+)\. \[( |x)\] (.*)$/);
          if (m) {
            parsed.push({ n: m[1], done: m[2] === "x", text: m[3].replace(/\s+\(done [^)]*\)\s*$/, "") });
          }
        }
        const open = parsed.filter((it) => !it.done);
        const done = parsed.filter((it) => it.done);
        this.items = [...open, ...done];
        this.error = false;
        if (this.selected >= this.items.length) {
          this.selected = Math.max(0, this.items.length - 1);
        }
      } catch (_err) {
        if (seq !== this.seq) return;
        this.items = [];
        this.error = true;
      }
      cx.notify();
    });
  }

  prevTown(cx) {
    const towns = getTowns();
    if (towns.length <= 1) return;
    this.at = (this.at + towns.length - 1) % towns.length;
    this.selected = 0;
    this.items = null;
    this.error = false;
    cx?.notify?.();
    this.load(cx);
  }

  nextTown(cx) {
    const towns = getTowns();
    if (towns.length <= 1) return;
    this.at = (this.at + 1) % towns.length;
    this.selected = 0;
    this.items = null;
    this.error = false;
    cx?.notify?.();
    this.load(cx);
  }

  toggle(item, cx) {
    if (!item || item.n == null) return;
    const towns = getTowns();
    const town = towns[this.at];
    if (!town) return;
    const opts = getExecOpts(town);
    const action = item.done ? "undo" : "done";
    const runner = cx?.spawn ? cx : this.savedCx;
    runner?.spawn?.(async (cx) => {
      try {
        await exec("todo", [action, String(item.n)], opts);
      } catch {}
      this.load(cx);
    });
  }

  add(cx) {
    const text = String(this.input.value() ?? "").trim();
    if (!text) return;
    this.input.set_value("");
    const towns = getTowns();
    const town = towns[this.at];
    if (!town) return;
    const opts = getExecOpts(town);
    const runner = cx?.spawn ? cx : this.savedCx;
    runner?.spawn?.(async (cx) => {
      try {
        await exec("todo", ["add", text], opts);
      } catch {}
      this.load(cx);
    });
  }

  close() {
    const p = props() ?? {};
    if (p.overlay) {
      closeOverlay(p.overlay);
      return;
    }
    const roles = { ...(shared("pocket.pane.roles") ?? {}) };
    const pane = this.pane ?? p.pane ?? panes().find((x) => roles[x.pane] === "quest")?.pane;
    if (pane) {
      delete roles[pane];
      setShared("pocket.pane.roles", roles);
      run("pane.close", { pane });
    }
  }

  key(e, cx) {
    if (this.typing) {
      if (e.key === "escape") {
        this.typing = false;
        this.focus.focus();
        cx.stop_propagation();
      }
      return;
    }
    const k = e.key;
    if (k === "escape") {
      this.close();
      cx.stop_propagation();
      return;
    }
    if (k === "up" || k === "k") {
      if (this.items && this.items.length > 0) {
        this.selected = (this.selected + this.items.length - 1) % this.items.length;
        cx.notify();
      }
      cx.stop_propagation();
      return;
    }
    if (k === "down" || k === "j") {
      if (this.items && this.items.length > 0) {
        this.selected = (this.selected + 1) % this.items.length;
        cx.notify();
      }
      cx.stop_propagation();
      return;
    }
    if (k === "left" || k === "h") {
      this.prevTown(cx);
      cx.stop_propagation();
      return;
    }
    if (k === "right" || k === "l") {
      this.nextTown(cx);
      cx.stop_propagation();
      return;
    }
    if (k === "enter" || k === "space") {
      if (this.items && this.items[this.selected]) {
        this.toggle(this.items[this.selected], cx);
      }
      cx.stop_propagation();
      return;
    }
  }

  render(_cx) {
    const towns = getTowns();
    if (this.at >= towns.length) this.at = Math.max(0, towns.length - 1);
    const town = towns[this.at];

    const titleRow = h_flex()
      .items_center()
      .gap(12)
      .child(
        div()
          .flex_none()
          .text_size(BIG)
          .font_family(FONT_BIG)
          .line_height(LH(BIG))
          .text_color(M.yellow)
          .child(tr("NHIỆM VỤ", "QUEST LOG")),
      )
      .child(
        h_flex()
          .items_center()
          .gap(6)
          .child(
            div()
              .cursor_pointer()
              .text_color(M.overlay1)
              .hover((s) => s.text_color(M.yellow))
              .on_click((_e, cx) => {
                cx.stop_propagation();
                this.prevTown(cx);
              })
              .child("◀"),
          )
          .child(
            div()
              .text_size(BIG)
              .font_family(FONT_BIG)
              .line_height(LH(BIG))
              .text_color(INK)
              .child(town ? town.name.toUpperCase() : ""),
          )
          .child(
            div()
              .cursor_pointer()
              .text_color(M.overlay1)
              .hover((s) => s.text_color(M.yellow))
              .on_click((_e, cx) => {
                cx.stop_propagation();
                this.nextTown(cx);
              })
              .child("▶"),
          ),
      );

    const rows = (this.items ?? []).map((item, idx) => {
      const isSel = this.selected === idx;
      const marker = item.done
        ? glyph("check", 10).text_color(M.green)
        : div().w(10).h(10).flex_none().border(1).border_color(M.surface2).rounded(2);

      return h_flex()
        .id("quest-" + item.n)
        .h(Math.round(TEXT * 1.6))
        .items_center()
        .gap(8)
        .cursor_pointer()
        .on_hover((h, cx) => {
          if (h && this.selected !== idx) {
            this.selected = idx;
            cx.notify();
          }
        })
        .on_click((_e, cx) => {
          cx.stop_propagation();
          this.selected = idx;
          this.toggle(item, cx);
        })
        .child(cursor(isSel))
        .child(marker)
        .child(
          div()
            .flex_1()
            .min_w(0)
            .truncate()
            .text_size(TEXT)
            .line_height(LH(TEXT))
            .text_color(item.done ? M.overlay1 : INK)
            .child(item.text),
        );
    });

    let listContent;
    if (this.error) {
      listContent = div()
        .py(8)
        .text_size(TEXT)
        .line_height(LH(TEXT))
        .text_color(M.overlay1)
        .child(tr("Không có lệnh todo ở đây", "No todo command here"));
    } else if (this.items === null) {
      listContent = div()
        .py(8)
        .text_size(TEXT)
        .line_height(LH(TEXT))
        .text_color(DARK)
        .child("…");
    } else {
      listContent = v_flex().gap(2).children(rows);
    }

    const scrollList = div()
      .id("quest-scroll")
      .flex_1()
      .min_h(0)
      .overflow_y_scrollbar()
      .child(listContent);

    const bottomInput = Input.new(this.input)
      .h(34)
      .flex_none()
      .px(8)
      .rounded(3)
      .border(2)
      .border_color(M.mauve)
      .bg(PAPER)
      .font_family(FONT)
      .text_size(TEXT)
      .text_color(INK);

    const footer = div()
      .text_size(SMALL)
      .font_family(FONT_SMALL)
      .line_height(LH(SMALL))
      .text_color(M.overlay1)
      .child(
        tr(
          "↑↓ chọn · Enter xong · ←→ thị trấn · Esc đóng",
          "↑↓ select · Enter done · ←→ town · Esc close",
        ),
      );

    const body = v_flex()
      .size_full()
      .gap(10)
      .child(titleRow)
      .child(scrollList)
      .child(bottomInput)
      .child(footer);

    return frame(body, { id: "quest", full: true, pad: 14 })
      .track_focus(this.focus)
      .on_key_down((e, cx) => this.key(e, cx));
  }
}
