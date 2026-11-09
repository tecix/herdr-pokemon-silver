// Pocket role "map": the town map (MENU > BẢN ĐỒ), a dialog. Every space is
// a town, every machine an island (this computer first), towns joined by a
// route in space order. A town's square takes its space's status color; the
// shown one has the blinking cursor; its agents' Pokémon stand beside it.
// Hover (or arrows) names the town at the top, like Gen 2's map; click or
// Enter goes there and closes the map. Every known machine is an island, even
// one with no town yet; each ends in "+ THỊ TRẤN MỚI", which founds a new town
// (space.new) on that machine; N does it on the island under the cursor.
import { div } from "gpui-kit";
import { props, closeOverlay, run, spaces, home, machines } from "herdr";
import {
  frame, v_flex, h_flex, cursor, mon, pokeball, M, INK, DARK, TEXT, SMALL, BIG, FONT, FONT_SMALL, FONT_BIG, LH,
  STATUS_COLOR, STATUS, agentList, crisp, zoom,
} from "./kit.js";

const TOWN = 16; // a town's square
const ROUTE = 18; // the route between two towns
const ISLAND_W = 300;

function waves(n) {
  let s = 11;
  const next = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: n }, () => ({ x: next(), y: next(), w: 4 + Math.floor(next() * 6) }));
}

function folderName(f) {
  if (!f) return "~";
  const h = home();
  return f === h ? "~" : f.startsWith(h + "/") ? "~" + f.slice(h.length) : f;
}

export default class Role {
  init(_props, cx) {
    this.at = Math.max(0, spaces().findIndex((s) => s.active));
    this.size = { width: 900, height: 600 };
    this.sea = waves(40);
    this.focus = cx.focus_handle();
    cx.timer.after(0, () => this.focus.focus());
  }

  go(s) {
    run("space.select", { id: s.id });
    const p = props() ?? {};
    if (p.overlay) closeOverlay(p.overlay);
  }

  // A new space on this island's machine ("" = this computer), then close.
  found(machine) {
    run("space.new", { machine: machine ?? "" });
    const p = props() ?? {};
    if (p.overlay) closeOverlay(p.overlay);
  }

  key(e, cx, order) {
    const k = e.key;
    if (k === "n") { cx.stop_propagation(); return this.found(order[this.at]?.machine); }
    if (k === "down" || k === "right" || k === "j" || k === "l") this.at = (this.at + 1) % order.length;
    else if (k === "up" || k === "left" || k === "k" || k === "h") this.at = (this.at + order.length - 1) % order.length;
    else if (k === "enter" || k === "space") return order[this.at] && this.go(order[this.at]);
    else return;
    cx.stop_propagation();
    cx.notify();
  }

  town(s, i, agents) {
    const here = this.at === i;
    const color = STATUS_COLOR[s.status] ?? M.surface2;
    const iconH = crisp(30, 23);
    let square = div().w(TOWN).h(TOWN).flex_none().rounded(2).border(2).border_color(here ? M.yellow : M.text).bg(color);
    if (s.status === "blocked") square = square.loop("opacity", { from: 0.4, to: 1, period: 800 });
    const icons = h_flex().gap(2).items_center().children(
      agents.slice(0, 5).map((a) => div().w((iconH * 4) / 3).h(iconH).flex_none().child(a.pane ? mon(a.pane, "icon", iconH) : pokeball(10))),
    );
    return h_flex()
      .id("town-" + s.id)
      .h(Math.max(TOWN, iconH) + 4)
      .items_center()
      .gap(8)
      .cursor_pointer()
      .on_hover((h, cx) => { if (h && this.at !== i) { this.at = i; cx.notify(); } })
      .on_click((_e, cx) => { cx.stop_propagation(); this.go(s); })
      .child(cursor(s.active))
      .child(square)
      .child(div().max_w(150).truncate().text_size(TEXT).line_height(LH(TEXT)).text_color(here ? INK : DARK).child(s.name.toUpperCase()))
      .child(icons);
  }

  render(_cx) {
    const all = spaces();
    const agents = agentList();
    // Islands: this computer first, then each machine, keeping space order.
    const groups = new Map();
    for (const m of machines() ?? []) groups.set(m.name ?? "", []);
    if (!groups.has("")) groups.set("", []);
    const away = new Set((machines() ?? []).filter((m) => m.layout === "unavailable").map((m) => m.name ?? ""));
    for (const s of all) {
      const k = s.machine ?? "";
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(s);
    }
    const keys = [...groups.keys()].sort((a, b) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)));
    const order = keys.flatMap((k) => groups.get(k));
    if (this.at >= order.length) this.at = Math.max(0, order.length - 1);
    const at = order[this.at];

    const islands = keys.map((k) => {
      let col = v_flex().gap(0);
      groups.get(k).forEach((s, j) => {
        const i = order.indexOf(s);
        if (j > 0) col = col.child(div().ml(14 + TOWN / 2 - 2).w(4).h(ROUTE).bg(M.peach).opacity(0.8));
        col = col.child(this.town(s, i, agents.filter((a) => a.space === s.id)));
      });
      col = col.child(
        h_flex()
          .id("found-" + (k || "here"))
          .mt(groups.get(k).length ? 8 : 0)
          .h(TOWN + 4)
          .items_center()
          .gap(8)
          .cursor_pointer()
          .text_color(M.overlay1)
          .hover((st) => st.text_color(M.yellow))
          .on_click((_e, cx) => { cx.stop_propagation(); this.found(k); })
          .child(div().w(14).flex_none())
          .child(div().w(TOWN).h(TOWN).flex_none().rounded(2).border(2).border_dashed().border_color(M.overlay0))
          .child(div().text_size(TEXT).line_height(LH(TEXT)).child("+ THỊ TRẤN MỚI")),
      );
      return v_flex()
        .w(ISLAND_W)
        .flex_none()
        .gap(8)
        .p(12)
        .rounded(10)
        .bg(M.surface0)
        .border(2)
        .border_color(M.green)
        .opacity(away.has(k) ? 0.5 : 1)
        .child(div().text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(M.green).child((k ? `ĐẢO ${k.toUpperCase()}` : "MÁY NÀY") + (away.has(k) ? "  ·  mất liên lạc" : "")))
        .child(col);
    });

    // The sea: the islands float on it, with a few seeded waves.
    let sea = div()
      .id("sea")
      .relative()
      .flex_1()
      .min_h(0)
      .rounded(4)
      .bg(M.crust)
      .overflow_hidden()
      .on_size_change((size, cx) => {
        const w = size.width / zoom();
        const h = size.height / zoom();
        if (Math.abs(w - this.size.width) > 1 || Math.abs(h - this.size.height) > 1) { this.size = { width: w, height: h }; cx.notify(); }
      });
    for (const w of this.sea) sea = sea.child(div().absolute().left(w.x * this.size.width).top(w.y * this.size.height).w(w.w).h(2).bg(M.surface1));
    sea = sea.child(
      div().id("islands").absolute().left(0).top(0).size_full().p(20).overflow_y_scrollbar()
        .flex().flex_col().justify_center()
        .child(h_flex().flex_wrap().justify_center().items_start().gap(28).children(islands)),
    );

    // The top line: the town under the cursor.
    const agentsAt = at ? agents.filter((a) => a.space === at.id) : [];
    const word = at?.status ? STATUS[at.status]?.say : null;
    const info = at
      ? [`${agentsAt.length} agent`, word, folderName(at.folder), at.branch ? `nhánh ${at.branch}` : null].filter(Boolean).join("  ·  ")
      : "";
    const head = h_flex()
      .items_end()
      .gap(12)
      .child(div().flex_none().text_size(BIG).font_family(FONT_BIG).line_height(LH(BIG)).text_color(M.yellow).child("BẢN ĐỒ"))
      .child(div().flex_none().text_size(BIG).font_family(FONT_BIG).line_height(LH(BIG)).text_color(INK).child(at ? at.name.toUpperCase() : ""))
      .child(div().flex_1().min_w(0).truncate().text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(DARK).child(info));

    const foot = div().text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(M.overlay1)
      .child("↑↓ chọn thị trấn  ·  Enter đến đó  ·  N thị trấn mới  ·  Esc đóng");

    return frame(v_flex().size_full().gap(10).child(head).child(sea).child(foot), { id: "map", full: true, pad: 12 })
      .track_focus(this.focus)
      .on_key_down((e, cx) => this.key(e, cx, order));
  }
}
