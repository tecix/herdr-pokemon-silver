// Pocket role "inbox": the notification list (kit openInbox; the top bar's THƯ
// button, the START menu). Every event in shared "pocket.events", newest first:
// the agent's Pokémon, the text, when, its tag. Unread ones have a dot and a
// brighter text. Click a row: mark it read and go to its agent. The ✓ on a row
// marks it read or unread. ĐỌC HẾT marks all read; XÓA ĐÃ ĐỌC removes the read
// ones. TẤT CẢ / CHƯA ĐỌC filters. Esc closes.
import { div } from "gpui-kit";
import { props, closeOverlay, run } from "herdr";
import {
  frame, h_flex, v_flex, M, INK, DARK, PAPER, SELECT, FONT, TEXT, SMALL, BIG, FONT_SMALL, FONT_BIG, LH,
  events, markRead, markAllRead, clearRead, unreadCount, agentList, agentName, mon, pokeball, glyph,
} from "./kit.js";

const PILL = {
  evolve: ["TIẾN HÓA!", M.yellow],
  shiny: ["SHINY!", M.pink],
  blocked: ["CHỜ", M.red],
  done: ["XONG", M.green],
};

function ago(at) {
  const min = Math.floor((Date.now() - at) / 60000);
  if (min < 1) return "vừa xong";
  if (min < 60) return `${min} phút trước`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} giờ trước`;
  return `${Math.floor(min / 1440)} ngày trước`;
}

function pill(text, bg) {
  return div().flex_none().px(4).rounded(8).bg(bg).text_color(M.crust)
    .text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).child(text);
}

function button(id, label, onClick, o = {}) {
  return h_flex()
    .id(id)
    .flex_none()
    .h(26)
    .px(10)
    .items_center()
    .rounded(3)
    .border(2)
    .border_color(o.on ? M.mauve : M.surface2)
    .bg(o.on ? M.surface0 : PAPER)
    .text_color(o.dim ? M.overlay0 : o.on ? M.yellow : INK)
    .text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL))
    .when(!o.dim, (e) => e.cursor_pointer().hover((s) => s.bg(M.surface1)).on_click((_e, cx) => { cx.stop_propagation(); onClick(cx); }))
    .child(label);
}

export default class Role {
  init(_props, cx) {
    this.only = false; // CHƯA ĐỌC filter
    this.focus = cx.focus_handle();
    cx.timer.after(0, () => this.focus.focus());
    cx.timer.every(30000, (cx) => cx.notify()); // "x phút trước"
  }

  close() {
    const p = props() ?? {};
    if (p.overlay) closeOverlay(p.overlay);
  }

  row(e, all) {
    const who = e.address ? all.find((a) => a.address === e.address) : null;
    const tag = e.kind === "blocked" && who?.status !== "blocked" ? ["ĐÃ QUA", M.overlay1] : PILL[e.kind];
    const pic = div().w(40).h(30).flex_none().flex().items_center().justify_center()
      .child(who?.pane ? mon(who.pane, "icon", 30) : pokeball(14));
    let meta = h_flex().gap(6).items_center().min_w(0)
      .child(div().min_w(0).truncate().text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(DARK)
        .child([ago(e.at), who ? agentName(who) : null].filter(Boolean).join("  ·  ")));
    if (tag) meta = meta.child(pill(tag[0], tag[1]));
    const check = div()
      .id("ib-rd-" + e.id)
      .flex_none()
      .w(24)
      .h(24)
      .flex()
      .items_center()
      .justify_center()
      .rounded(3)
      .border(1)
      .border_color(e.read ? M.surface1 : M.surface2)
      .text_color(e.read ? M.green : M.overlay0)
      .cursor_pointer()
      .hover((s) => s.bg(M.surface1).text_color(INK))
      .on_click((_ev, cx) => { cx.stop_propagation(); markRead(e.id, !e.read); cx.notify(); })
      .child(glyph("check", 10));
    return h_flex()
      .id("ib-" + e.id)
      .flex_none()
      .gap(8)
      .px(6)
      .py(4)
      .items_center()
      .rounded(3)
      .bg(e.read ? PAPER : SELECT)
      .hover((s) => s.bg(M.surface0))
      .cursor_pointer()
      .on_click((_ev, cx) => {
        markRead(e.id);
        if (e.address) {
          run("agent.focus", { terminal: e.address });
          this.close();
        } else cx.notify();
      })
      .child(div().w(8).h(8).flex_none().rounded(4).bg(e.read ? "#00000000" : M.mauve))
      .child(pic)
      .child(v_flex().flex_1().min_w(0).gap(1)
        .child(div().min_w(0).truncate().text_size(TEXT).line_height(LH(TEXT)).text_color(e.read ? DARK : INK).child(e.text))
        .child(meta))
      .child(check);
  }

  render(_cx) {
    const list = events();
    const unread = unreadCount();
    const shown = this.only ? list.filter((e) => !e.read) : list;
    const all = agentList();
    const hasRead = list.some((e) => e.read);

    const head = h_flex().flex_none().items_end().gap(8)
      .child(div().text_size(BIG).font_family(FONT_BIG).line_height(LH(BIG)).text_color(M.yellow).child("THÔNG BÁO"))
      .child(div().pb(2).text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(DARK)
        .child(unread ? `${unread} chưa đọc` : "đã đọc hết"))
      .child(div().flex_1())
      .child(div().id("ib-x").flex_none().px(6).text_color(DARK).cursor_pointer().hover((s) => s.text_color(INK))
        .on_click(() => this.close()).child("X"));

    const tools = h_flex().flex_none().gap(6).items_center()
      .child(button("ib-all", "TẤT CẢ", (cx) => { this.only = false; cx.notify(); }, { on: !this.only }))
      .child(button("ib-unread", `CHƯA ĐỌC (${unread})`, (cx) => { this.only = true; cx.notify(); }, { on: this.only }))
      .child(div().flex_1())
      .child(button("ib-readall", "ĐỌC HẾT", (cx) => { markAllRead(); cx.notify(); }, { dim: !unread }))
      .child(button("ib-clear", "XÓA ĐÃ ĐỌC", (cx) => { clearRead(); cx.notify(); }, { dim: !hasRead }));

    const body = shown.length
      ? v_flex().gap(2).children(shown.map((e) => this.row(e, all)))
      : div().p(12).text_color(DARK).child(this.only ? "Không còn thông báo chưa đọc." : "Chưa có thông báo nào.");

    const content = v_flex().size_full().gap(8)
      .child(head)
      .child(tools)
      .child(div().id("ib-scroll").flex_1().min_h(0).overflow_y_scrollbar().pr(4).child(body));

    return frame(content, { id: "inbox", full: true, pad: 10 })
      .font_family(FONT)
      .track_focus(this.focus)
      .on_key_down((e, cx) => {
        if (e.key === "escape") { this.close(); cx.stop_propagation(); }
      });
  }
}
