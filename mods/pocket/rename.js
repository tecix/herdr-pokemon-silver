// Pocket role "rename": the dialog that names a pane or a tab (kit openRename /
// openRenameTab, opened by right-clicking a pane's header or a tab pill), drawn
// like Gen 2's nickname box.
// props { role: "rename", pane?, tab?, value, overlay }. Enter or LƯU saves it:
//   - for a pane: saves in shared "pocket.names" (kit setPaneName), and if its
//     tab has only 1 pane, also updates the tab's name (tab.rename).
//   - for a tab: runs tab.rename, and if the tab has only 1 pane, also syncs
//     that pane's name in shared "pocket.names".
import { div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { props, closeOverlay, panes, spaces, run } from "herdr";
import { M, INK, DARK, PAPER, FONT, TEXT, SMALL, BIG, FONT_SMALL, FONT_BIG, LH, setPaneName, paneName, agentList, agentName, tr } from "./kit.js";

export default class Role {
  init(_props, cx) {
    const p = props() ?? {};
    const tabObj = p.tab ? spaces().flatMap((s) => s.tabs).find((t) => t.id === p.tab) : null;
    const value = p.value ?? (p.pane ? paneName(p.pane) : (tabObj?.named ? tabObj.name : "")) ?? "";
    this.input = InputState.new({ value, placeholder: tr("Để trống: tên tự động", "Leave blank for automatic name") });
    if (value) this.input.set_selected_range({ start: 0, end: value.length });
    this.input.on("submit", () => this.save());
    this.input.focus();
    cx.timer.after(300, () => this.input.focus());
    this.handle = cx.focus_handle();
  }

  save() {
    const p = props() ?? {};
    const val = String(this.input.value() ?? "").trim();
    if (p.tab && !p.pane) {
      run("tab.rename", { id: p.tab, name: val });
      const tabPanes = panes().filter((x) => x.tab === p.tab);
      if (tabPanes.length === 1) {
        setPaneName(tabPanes[0].pane, val);
      }
    } else if (p.pane) {
      setPaneName(p.pane, val);
      const paneObj = panes().find((x) => x.pane === p.pane);
      const tabId = paneObj?.tab;
      const tabPanes = tabId ? panes().filter((x) => x.tab === tabId) : [];
      if (tabId && tabPanes.length === 1) {
        run("tab.rename", { id: tabId, name: val });
      }
    }
    if (p.overlay) closeOverlay(p.overlay);
  }

  close() {
    const p = props() ?? {};
    if (p.overlay) closeOverlay(p.overlay);
  }

  render(_cx) {
    const p = props() ?? {};
    const isTab = Boolean(p.tab && !p.pane);
    const tabObj = isTab ? spaces().flatMap((s) => s.tabs).find((t) => t.id === p.tab) : null;
    const tabPanes = isTab ? panes().filter((x) => x.tab === p.tab) : [];
    const targetPaneId = p.pane ?? (tabPanes.length === 1 ? tabPanes[0].pane : null);
    const pane = targetPaneId ? panes().find((x) => x.pane === targetPaneId) : null;
    const a = targetPaneId ? agentList().find((x) => x.pane === targetPaneId) : null;
    // What it is called without a name of its own.
    const auto = a
      ? agentName({ ...a, pane: null })
      : pane?.program?.name || pane?.title || tabObj?.name || "";
    const titleText = isTab ? tr("ĐẶT TÊN TAB", "RENAME TAB") : tr("ĐẶT TÊN", "RENAME");
    const subText = auto
      ? tr(`Tên tự động: ${auto}`, `Automatic name: ${auto}`)
      : isTab
        ? tr("Đặt tên cho tab này", "Name this tab")
        : tr("Đặt tên cho khung này", "Name this pane");
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
          .child(div().text_size(BIG).font_family(FONT_BIG).line_height(LH(BIG)).text_color(M.yellow).child(titleText))
          .child(div().text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(DARK).truncate()
            .child(subText)),
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
          .child(button("rn-cancel", tr("HỦY", "CANCEL"), false, () => this.close()))
          .child(button("rn-save", tr("LƯU", "SAVE"), true, () => this.save())),
      );
  }
}
