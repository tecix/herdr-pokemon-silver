// Pocket role "party": the left sidebar, drawn as a Gen 2 party menu. The
// title and the map stay fixed; the party (up to 6, pinned first) and the PC
// box scroll between them. Narrower than 160px it becomes a rail of party
// sprites only.
import { div } from "gpui-kit";
import { spaces, run, setAgentOrder } from "herdr";
import {
  M, INK, DARK, LIGHT, PAPER, FOCUS, FONT, TEXT, SMALL, STATUS_COLOR,
  frame, cursor, bar, mon, monFit, pokeball, zoom, openPicker, openAgentInfo, monNameOf, monsterName,
  agentName, moodOf, moodBubble, hpOf, levelOf, h_flex, v_flex, agentList, FONT_SMALL, LH, lhPx, modelBadge, crisp } from "./kit.js";

const PARTY_MAX = 6;
const NARROW = 160;
// A card: the Pokémon's 40x30 menu icon (Gen 2 party menu style) at a
// whole-pixel scale near 46px tall at the card's left edge, then four lines
// (name, space + model, HP, EXP). No cursor column: focus is the card's color.
const iconH = () => crisp(30, 46);
const iconW = () => (iconH() * 4) / 3;
const CARD_PAD = 4;
// What a card's chrome and the icon take from the sidebar's width, so the
// HP/EXP tracks fill the rest: root px 6+6, scroll pr 4, frame (2+2+1+pad)x2,
// icon, gap 6.
const barWidth = (w) => Math.max(60, Math.floor((w ?? 300) - 16 - (5 + CARD_PAD) * 2 - iconW() - 6 - 2));
// The model badge, smaller than the small text.
const MODEL_SIZE = () => Math.round(SMALL * 0.8 * 10) / 10;
// The map's status dot column and row height: fixed, so the dots and cursors
// line up across rows.
const DOT_COL = 10;
const MAP_ROW = 20;

// The Pokémon's menu icon, Gen 2 party style: it hops while working, shivers
// while it waits on you, and sleeping it is dimmed and lies still.
function iconBox(a, mood) {
  const h = iconH();
  const w = iconW();
  const art = a.pane ? mon(a.pane, "icon", h) : pokeball(Math.round(h * 0.5));
  let pic = div().id("pi-" + a.address).absolute().left(0).top(0).w(w).h(h).flex().items_center().justify_center().child(art);
  if (mood === "walk") pic = pic.loop("top", { from: 0, to: -4, period: 360, easing: "linear" });
  else if (mood === "alert") pic = pic.loop("left", { from: -1.5, to: 1.5, period: 160, easing: "linear" });
  else if (mood === "sleep") pic = pic.opacity(0.35);
  // Right-click the icon: choose the Pokémon (the rest of the card: info).
  return div()
    .id("pib-" + a.address)
    .w(w).h(h).flex_none().relative()
    .on_mouse_down("right", (_e, cx) => {
      cx.stop_propagation();
      openPicker(a.pane);
    })
    .child(pic);
}

// A small picture (rail, PC box): the Pokémon, or a Poké Ball in the same box
// when its pane is gone. `size` tall; icons are 4/3 of it wide.
function picture(a, kind, size) {
  const w = kind === "icon" ? Math.round(size * 4 / 3) : size;
  const art = a.pane ? mon(a.pane, kind, size) : pokeball(Math.round(size * 0.45));
  return div().w(w).h(size).flex_none().flex().items_center().justify_center().child(art);
}

// One party card: the Pokémon's icon, then four lines:
//   agent name (the whole line)
//   space ............................ [icon] Op5.5 ▂▄▆  (small)
//   [══════════ HP: 5-hour limit left ══════════]
//   [── EXP, thin ──────────────────────────────]
// Focused: inverted. Waiting on you: red border. Asleep: dimmed icon and name.
// Right-click: the icon chooses the Pokémon, the rest opens the agent's info.
function slot(a, barW) {
  const exp = levelOf(a.address).exp;
  const hp = hpOf(a);
  const mood = moodOf(a);
  const small = (el) => el.text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(DARK);

  const line1 = div()
    .h(lhPx(TEXT))
    .min_w(0)
    .truncate()
    .text_color(mood === "sleep" ? DARK : INK)
    .text_size(TEXT)
    .line_height(LH(TEXT))
    .child(agentName(a));

  const line2 = h_flex()
    .h(lhPx(SMALL))
    .items_center()
    .gap(6)
    .child(small(div().flex_1().min_w(0).truncate()).child(a.space_name ?? ""))
    .child(modelBadge(a, MODEL_SIZE()));

  const line3 = h_flex().h(9).items_center().child(bar("", hp, barW, { blink: true, h: 7 }));
  // EXP: a thin blue bar under HP (full = evolve, or shiny).
  const line4 = h_flex().h(5).items_center().child(bar("", exp, barW, { fg: M.blue, h: 4 }));

  const info = v_flex().flex_1().min_w(0).gap(2).justify_center().child(line1).child(line2).child(line3).child(line4);
  const row = h_flex()
    .items_center()
    .gap(6)
    .child(iconBox(a, mood))
    .child(info);
  return frame(row, { id: "pt-" + a.address, inverted: a.focused, pad: CARD_PAD, edge: mood === "alert" ? M.red : undefined })
    .flex_none()
    .cursor_pointer()
    .on_click(() => run("agent.focus", { terminal: a.address }))
    .on_mouse_down("right", (_e, cx) => {
      cx.stop_propagation();
      openAgentInfo(a.address);
    });
}

// One PC box row: the small picture, the agent's name first and its space
// second, then the model (small).
function boxRow(a) {
  return h_flex()
    .id("bx-" + a.address)
    .items_center()
    .gap(6)
    .py(3)
    .border_b(1)
    .border_color(M.surface1)
    .cursor_pointer()
    .on_click(() => run("agent.focus", { terminal: a.address }))
    .on_mouse_down("right", (_e, cx) => {
      cx.stop_propagation();
      openAgentInfo(a.address);
    })
    .child(picture(a, "icon", 30))
    .child(
      v_flex()
        .flex_1()
        .min_w(0)
        .child(
          div()
            .truncate()
            .text_color(moodOf(a) === "sleep" ? DARK : INK)
            .text_size(TEXT)
            .line_height(LH(TEXT))
            .child(agentName(a)),
        )
        .child(
          div()
            .truncate()
            .text_color(DARK)
            .text_size(SMALL).font_family(FONT_SMALL)
            .line_height(LH(SMALL))
            .child(a.space_name ?? ""),
        ),
    )
    .child(modelBadge(a, MODEL_SIZE()));
}

// A section title, with top padding so the accents (Ồ, Ệ...) aren't clipped.
function sectionTitle(text) {
  return div()
    .flex_none()
    .pt(6)
    .pb(2)
    .px(4)
    .text_size(TEXT)
    .line_height(`${TEXT + 4}px`)
    .text_color(M.yellow)
    .child(text);
}

// The map: the spaces as towns. The shown one has the cursor; a status dot in
// a fixed column when it has one.
function mapSection(list) {
  const rows = list.map((s) => {
    const dot = STATUS_COLOR[s.status];
    const dotCol = div().w(DOT_COL).h(MAP_ROW).flex_none().flex().items_center().justify_center();
    if (dot) dotCol.child(div().w(8).h(8).rounded(4).bg(dot));
    return h_flex()
      .id("sp-" + s.id)
      .h(MAP_ROW)
      .items_center()
      .gap(4)
      .cursor_pointer()
      .on_click(() => run("space.select", { id: s.id }))
      .child(cursor(s.active))
      .child(
        div()
          .flex_1()
          .min_w(0)
          .truncate()
          .text_size(TEXT)
          .line_height(LH(TEXT))
          .child(s.name.toUpperCase()),
      )
      .child(dotCol);
  });
  return v_flex()
    .flex_none()
    .gap(2)
    .child(sectionTitle("BẢN ĐỒ"))
    .child(frame(v_flex().gap(2).children(rows), { id: "map" }));
}

// Narrow rail: party sprites only, stacked; the focused one framed.
function rail(party) {
  return v_flex()
    .flex_1()
    .min_h(0)
    .overflow_y_scrollbar()
    .items_center()
    .gap(6)
    .children(party.map((a) =>
      div()
        .id("pt-" + a.address)
        .flex_none()
        .p(2)
        .border(2)
        .border_color(a.focused ? FOCUS : LIGHT)
        .bg(a.focused ? PAPER : LIGHT)
        .cursor_pointer()
        .on_click(() => run("agent.focus", { terminal: a.address }))
        .on_mouse_down("right", (_e, cx) => {
          cx.stop_propagation();
          openPicker(a.pane);
        })
        .child(picture(a, "icon", 30)),
    ));
}

export default class Role {
  init(_props, _cx) {
    this.boxOpen = true;
    this.w = undefined;
  }

  render(_cx) {
    const all = agentList();
    const tabs = new Map(spaces().flatMap((s) => s.tabs.map((t) => [t.id, t])));
    const settled = (a) => tabs.get(a.tab)?.settled === true;
    const open = all.filter((a) => !settled(a));
    const ordered = [...open.filter((a) => a.pinned), ...open.filter((a) => !a.pinned)];
    const party = ordered.slice(0, PARTY_MAX);
    const box = [...ordered.slice(PARTY_MAX), ...all.filter(settled)];
    setAgentOrder([...party, ...box].map((a) => a.address));

    const root = v_flex()
      .id("party-root")
      .size_full()
      .bg(LIGHT)
      .font_family(FONT)
      .text_color(INK)
      .text_size(TEXT)
      .gap(8)
      .py(4)
      .px(6)
      .on_size_change((size, cx) => {
        this.w = size.width / zoom(); // reported in zoomed px
        cx.notify();
      });

    if (this.w !== undefined && this.w < NARROW) return root.child(rail(party));

    const partyList = party.length
      ? v_flex().flex_none().gap(6).children(party.map((a) => slot(a, barWidth(this.w))))
      : frame(
          v_flex()
            .gap(2)
            .child("Chưa có ai trong đội.")
            .child(div().text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(DARK).child("Mở một agent để bắt đầu!")),
        );

    // Only the party and the PC box scroll. The title and the map stay put.
    // The pt/pr/pb pads keep the cards' borders clear of the scroll edge.
    const scroll = v_flex()
      .id("party-scroll")
      .flex_1()
      .min_h(0)
      .overflow_y_scrollbar()
      .gap(8)
      .pt(2)
      .pr(4)
      .pb(2)
      .child(partyList);

    if (box.length) {
      const head = h_flex()
        .id("box-toggle")
        .items_center()
        .h(TEXT + 4)
        .text_size(TEXT)
        .line_height(LH(TEXT))
        .text_color(M.yellow)
        .px(4)
        .cursor_pointer()
        .on_click((_e, cx) => {
          this.boxOpen = !this.boxOpen;
          cx.notify();
        })
        .child(`HỘP PC (${box.length}) ${this.boxOpen ? "−" : "+"}`);
      let boxSection = v_flex().flex_none().gap(4).child(head);
      if (this.boxOpen) boxSection = boxSection.child(v_flex().px(4).children(box.map(boxRow)));
      scroll.child(boxSection);
    }

    return root
      .child(sectionTitle("ĐỘI HÌNH"))
      .child(scroll)
      .child(mapSection(spaces()));
  }
}
