// Pocket role "menu": the START menu, a Gen 2 style box with a ▶ cursor,
// opened by the top bar's MENU button (kit openMenu, a popup at the pointer).
// Up/down (or j/k) move, Enter picks, Esc closes (Herdr closes popups on Esc).
import { div } from "gpui-kit";
import { props, closeOverlay, run, focused } from "herdr";
import { frame, v_flex, h_flex, cursor, M, INK, DARK, TEXT, SMALL, FONT, FONT_SMALL, LH, openTrainer, openMap, openPicker, openQuest, openBag, agentList, tr, toggleLang } from "./kit.js";

// The focused pane's agent (its address), else the first agent.
function focusedAgent() {
  const f = focused();
  const all = agentList();
  return (all.find((a) => f?.pane && a.pane === f.pane) ?? all[0])?.address;
}

// [label, what it does, hint, keepOpen?]
function items() {
  return [
    [tr("THẺ TRAINER", "TRAINER CARD"), () => openTrainer(), tr("huy hiệu, Pokédex, thời gian", "badges, Pokédex, play time")],
    [tr("BẢN ĐỒ", "TOWN MAP"), () => openMap(), tr("các space như thị trấn", "spaces as towns")],
    ["POKÉMON", () => openPicker(focused()?.pane), tr("đổi Pokémon của pane này", "change this pane's Pokémon")],
    [tr("NHIỆM VỤ", "QUEST LOG"), () => openQuest(), tr("việc cần làm của từng thị trấn", "each town's to-do list")],
    [tr("TÚI ĐỒ", "BAG"), () => openBag(focusedAgent()), tr("lệnh nhanh cho agent này", "quick commands for this agent")],
    [tr("NGÔN NGỮ: VI", "LANGUAGE: EN"), () => toggleLang(), tr("đổi sang Tiếng Anh (English)", "switch to Tiếng Việt"), true],
    [tr("CÀI ĐẶT", "SETTINGS"), () => run("app.settings"), tr("cài đặt Herdr", "Herdr settings")],
    [tr("THOÁT", "EXIT"), null, ""],
  ];
}

export default class Role {
  init(_props, cx) {
    this.at = 0;
    this.focus = cx.focus_handle();
    cx.timer.after(0, () => this.focus.focus());
  }

  // Closes the menu, then opens the item's screen (after, so it isn't closed with it).
  // Items with keepOpen (e.g. language toggle) run in place so the menu stays open.
  pick(i, cx) {
    const list = items();
    const [, act, , keepOpen] = list[i] ?? [];
    if (keepOpen) {
      act?.();
      cx?.notify();
      return;
    }
    const p = props() ?? {};
    if (p.overlay) closeOverlay(p.overlay);
    act?.();
  }

  key(e, cx) {
    const list = items();
    const k = e.key;
    if (k === "down" || k === "j") this.at = (this.at + 1) % list.length;
    else if (k === "up" || k === "k") this.at = (this.at + list.length - 1) % list.length;
    else if (k === "enter" || k === "space") return this.pick(this.at, cx);
    else if ((k === "left" || k === "right" || k === "h" || k === "l") && list[this.at]?.[3]) return this.pick(this.at, cx);
    else return;
    cx.stop_propagation();
    cx.notify();
  }

  render(_cx) {
    const list = items();
    const rows = list.map(([label], i) =>
      h_flex()
        .id("mn-" + i)
        .h(Math.round(TEXT * 1.6))
        .items_center()
        .cursor_pointer()
        .on_hover((h, cx) => { if (h && this.at !== i) { this.at = i; cx.notify(); } })
        .on_click((_e, cx) => { cx.stop_propagation(); this.pick(i, cx); })
        .child(cursor(this.at === i))
        .child(div().text_size(TEXT).line_height(LH(TEXT)).text_color(this.at === i ? INK : DARK).child(label)));
    const hint = list[this.at]?.[2] ?? "";
    const body = v_flex()
      .size_full()
      .child(v_flex().flex_1().children(rows))
      .child(div().h(LH(SMALL)).truncate().text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(M.overlay2).child(hint || " "));
    return frame(body, { id: "menu", full: true, pad: 8 })
      .track_focus(this.focus)
      .on_key_down((e, cx) => this.key(e, cx));
  }
}
