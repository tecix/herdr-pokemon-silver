// Pocket role "menu": the START menu, a Gen 2 style box with a ▶ cursor,
// opened by the top bar's MENU button (kit openMenu, a popup at the pointer).
// Up/down (or j/k) move, Enter picks, Esc closes (Herdr closes popups on Esc).
import { div } from "gpui-kit";
import { props, closeOverlay, run, focused } from "herdr";
import { frame, v_flex, h_flex, cursor, M, INK, DARK, TEXT, SMALL, FONT, FONT_SMALL, LH, openTrainer, openMap, openPicker, openInbox, unreadCount } from "./kit.js";

// [label, what it does, hint]
const ITEMS = [
  ["THẺ TRAINER", () => openTrainer(), "huy hiệu, Pokédex, thời gian"],
  ["THÔNG BÁO", () => openInbox(), "đánh dấu đã đọc / đọc hết"],
  ["BẢN ĐỒ", () => openMap(), "các space như thị trấn"],
  ["POKÉMON", () => openPicker(focused()?.pane), "đổi Pokémon của pane này"],
  ["CÀI ĐẶT", () => run("app.settings"), "cài đặt Herdr"],
  ["THOÁT", null, ""],
];

export default class Role {
  init(_props, cx) {
    this.at = 0;
    this.focus = cx.focus_handle();
    cx.timer.after(0, () => this.focus.focus());
  }

  // Closes the menu, then opens the item's screen (after, so it isn't closed with it).
  pick(i) {
    const p = props() ?? {};
    if (p.overlay) closeOverlay(p.overlay);
    ITEMS[i][1]?.();
  }

  key(e, cx) {
    const k = e.key;
    if (k === "down" || k === "j") this.at = (this.at + 1) % ITEMS.length;
    else if (k === "up" || k === "k") this.at = (this.at + ITEMS.length - 1) % ITEMS.length;
    else if (k === "enter" || k === "space") return this.pick(this.at);
    else return;
    cx.stop_propagation();
    cx.notify();
  }

  render(_cx) {
    const rows = ITEMS.map(([label], i) =>
      h_flex()
        .id("mn-" + i)
        .h(Math.round(TEXT * 1.6))
        .items_center()
        .cursor_pointer()
        .on_hover((h, cx) => { if (h && this.at !== i) { this.at = i; cx.notify(); } })
        .on_click((_e, cx) => { cx.stop_propagation(); this.pick(i); })
        .child(cursor(this.at === i))
        .child(div().text_size(TEXT).line_height(LH(TEXT)).text_color(this.at === i ? INK : DARK).child(label)));
    const hint = ITEMS[this.at][2];
    const body = v_flex()
      .size_full()
      .child(v_flex().flex_1().children(rows))
      .child(div().h(LH(SMALL)).truncate().text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(M.overlay2).child(hint || " "));
    return frame(body, { id: "menu", full: true, pad: 8 })
      .track_focus(this.focus)
      .on_key_down((e, cx) => this.key(e, cx));
  }
}
