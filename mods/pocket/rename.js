// Pocket role "rename": the dialog that names a pane (kit openRename(pane, value),
// opened by right-clicking a pane's header), drawn like Gen 2's nickname box.
// props { role: "rename", pane, value, overlay }. Enter or LƯU saves it in
// shared "pocket.names" (kit setPaneName); an empty name goes back to the
// automatic one (tab name, session name, title). Esc or HỦY closes. The
// Pokémon stays as it is: that is the party card's right-click (openPicker).
import { div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { props, closeOverlay, panes } from "herdr";
import { M, INK, DARK, PAPER, FONT, TEXT, SMALL, BIG, FONT_SMALL, FONT_BIG, LH, setPaneName, paneName, agentList, agentName } from "./kit.js";

export default class Role {
  init(_props, cx) {
    const p = props() ?? {};
    const value = p.value ?? paneName(p.pane) ?? "";
    this.input = InputState.new({ value, placeholder: "Để trống: tên tự động" });
    if (value) this.input.set_selected_range({ start: 0, end: value.length });
    this.input.on("submit", () => this.save());
    this.input.focus();
    cx.timer.after(300, () => this.input.focus());
    this.handle = cx.focus_handle();
  }

  save() {
    const p = props() ?? {};
    setPaneName(p.pane, this.input.value());
    if (p.overlay) closeOverlay(p.overlay);
  }

  close() {
    const p = props() ?? {};
    if (p.overlay) closeOverlay(p.overlay);
  }

  render(_cx) {
    const p = props() ?? {};
    const pane = panes().find((x) => x.pane === p.pane);
    const a = agentList().find((x) => x.pane === p.pane);
    // What it is called without a name of its own.
    const auto = a ? agentName({ ...a, pane: null }) : pane?.program?.name || pane?.title || "";
    const button = (id, text, primary, action) =>
      h_flex()
        .id(id)
        .h(30)
        .px(12)
        .items_center()
        .rounded(3)
        .border(2)
        .border_color(primary ? M.mauve : M.surface2)
        .bg(primary ? M.surface0 : PAPER)
        .text_color(primary ? M.yellow : INK)
        .text_size(TEXT)
        .line_height(LH(TEXT))
        .cursor_pointer()
        .hover((s) => s.bg(M.surface1))
        .on_click(action)
        .child(text);

    return v_flex()
      .id("rename")
      .track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (e.key === "escape") {
          this.close();
          cx.stop_propagation();
        }
      })
      .size_full()
      .bg(PAPER)
      .text_color(INK)
      .font_family(FONT)
      .text_size(TEXT)
      .p(12)
      .gap(8)
      .child(
        v_flex()
          .flex_none()
          .gap(2)
          .child(div().text_size(BIG).font_family(FONT_BIG).line_height(LH(BIG)).text_color(M.yellow).child("ĐẶT TÊN"))
          .child(div().text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(DARK).truncate()
            .child(auto ? `Tên tự động: ${auto}` : "Đặt tên cho khung này")),
      )
      .child(
        Input.new(this.input)
          .h(34)
          .flex_none()
          .px(8)
          .rounded(3)
          .border(2)
          .border_color(M.mauve)
          .bg(PAPER)
          .font_family(FONT)
          .text_size(TEXT)
          .text_color(INK),
      )
      .child(div().flex_1())
      .child(
        h_flex()
          .flex_none()
          .gap(8)
          .justify_end()
          .child(button("rn-cancel", "HỦY", false, () => this.close()))
          .child(button("rn-save", "LƯU", true, () => this.save())),
      );
  }
}
