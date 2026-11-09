// Pocket role "fight": a Pokémon's moves, a popup at the pointer (kit
// openFight: right-click a Pokémon on the field). Gen 2 FIGHT box: the four
// moves with a ▶ cursor, the usable ones bright, the locked ones grey with
// what unlocks them; under it the hovered move's type. Up/down (or j/k) move,
// Enter or a click casts it (the field plays it), Esc closes. The last row
// changes the Pokémon (what right-click on the field did before).
// Props: { address, pane, overlay }.
import { div } from "gpui-kit";
import { props, closeOverlay } from "herdr";
import { monOf, monName, stageOf, shinyOf } from "./mons.js";
import { frame, v_flex, h_flex, cursor, M, INK, DARK, TEXT, SMALL, FONT_SMALL, LH, openPicker } from "./kit.js";
import { movesOf, castMove, TYPE_NAME, unlockedOf } from "./moves.js";

// Why a locked slot is locked: what it takes to open it.
function unlockHint(pane, i) {
  const dex = monOf(pane);
  const need = i + 1 - (1 + stageOf(dex) + (shinyOf(pane) ? 1 : 0));
  if (need <= 0) return "";
  return need === 1 ? "tiến hóa (hoặc shiny) để mở" : `cần thêm ${need} bậc tiến hóa / shiny`;
}

export default class Role {
  init(_props, cx) {
    this.at = 0;
    this.focus = cx.focus_handle();
    cx.timer.after(0, () => this.focus.focus());
  }

  close() {
    const o = props()?.overlay;
    if (o) closeOverlay(o);
  }

  // Row i: a move (0..3) or the last row, "ĐỔI POKÉMON".
  pick(i) {
    const p = props() ?? {};
    if (!p.pane) return;
    const moves = movesOf(p.pane);
    if (i < moves.length) {
      if (moves[i].locked) return;
      castMove(p.address, moves[i]);
      this.close();
    } else {
      this.close();
      openPicker(p.pane);
    }
  }

  key(e, cx) {
    const n = 5;
    const k = e.key;
    if (k === "down" || k === "j") this.at = (this.at + 1) % n;
    else if (k === "up" || k === "k") this.at = (this.at + n - 1) % n;
    else if (k === "enter" || k === "space") return this.pick(this.at);
    else return;
    cx.stop_propagation();
    cx.notify();
  }

  render(_cx) {
    const p = props() ?? {};
    if (!p.pane) return frame(div().child("Chưa chọn Pokémon nào."), { full: true });
    const moves = movesOf(p.pane);
    const rowH = Math.round(TEXT * 1.6);
    const row = (i, label, color) =>
      h_flex()
        .id("mv-" + i)
        .h(rowH)
        .items_center()
        .cursor_pointer()
        .on_hover((h, cx) => { if (h && this.at !== i) { this.at = i; cx.notify(); } })
        .on_click((_e, cx) => { cx.stop_propagation(); this.pick(i); })
        .child(cursor(this.at === i))
        .child(div().flex_1().min_w(0).truncate().text_size(TEXT).line_height(LH(TEXT)).text_color(color).child(label));

    const rows = moves.map((m, i) =>
      row(i, m.name, m.locked ? M.surface2 : this.at === i ? INK : DARK));
    rows.push(row(4, "ĐỔI POKÉMON", this.at === 4 ? M.yellow : M.overlay1));

    // The info line: the hovered move's type and power, or why it is locked.
    const m = moves[this.at];
    const info = !m
      ? "chọn Pokémon khác cho agent này"
      : m.locked
        ? `KHÓA · ${unlockHint(p.pane, this.at)}`
        : `HỆ/${TYPE_NAME[m.type] ?? m.type} · ${"★".repeat(m.tier + 1)}`;

    const dex = monOf(p.pane);
    const title = h_flex()
      .items_center()
      .gap(6)
      .child(div().flex_1().min_w(0).truncate().text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(M.yellow)
        .child(`${monName(dex)} · CHIÊU THỨC`))
      .child(div().flex_none().text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(DARK)
        .child(`${unlockedOf(p.pane)}/4`));

    const body = v_flex()
      .size_full()
      .gap(2)
      .child(title)
      .child(div().h(1).flex_none().bg(M.surface1))
      .child(v_flex().flex_1().children(rows))
      .child(div().h(LH(SMALL)).truncate().text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(M.overlay2).child(info));
    return frame(body, { id: "fight", full: true, pad: 8 })
      .track_focus(this.focus)
      .on_key_down((e, cx) => this.key(e, cx));
  }
}
