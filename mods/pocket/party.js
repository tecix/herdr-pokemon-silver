// Pocket role "party": the left sidebar, drawn as a Gen 2 party menu. The
// title and the map stay fixed; the party (up to 6, pinned first) and the PC
// box scroll between them. Narrower than 160px it becomes a rail of party
// sprites only.
import { div } from "gpui-kit";
import { spaces, run, setAgentOrder, machines, layout, terminals, shared } from "herdr";
import {
  M, INK, DARK, LIGHT, PAPER, FOCUS, FONT, TEXT, SMALL, STATUS_COLOR,
  frame, cursor, bar, mon, monFit, pokeball, zoom, openPicker, openAgentInfo, openTown, monNameOf, monsterName,
  agentName, moodOf, moodBubble, hpOf, hpColor, h_flex, v_flex, agentList, FONT_SMALL, LH, lhPx, modelBadge, crisp, tr
} from "./kit.js";
import { islandIcon } from "./scene.js";

const PARTY_MAX = 6;
const NARROW = 160;
// A card: the Pokémon's 40x30 menu icon (Gen 2 party menu style) at a
// whole-pixel scale near 46px tall at the card's left edge, then name,
// space + model badge, and an HP bar straddling the bottom border.
const iconH = () => crisp(30, 46);
const CARD_PAD = 4;
// A sub-agent's card: a smaller icon, tighter padding, indented under its
// parent behind a guide line.
const CHILD_ICON = () => crisp(30, 30);
const CHILD_PAD = 3;
const CHILD_INDENT = 14;
// The model badge, smaller than the small text.
const MODEL_SIZE = () => Math.round(SMALL * 0.8 * 10) / 10;
// The map's status dot column and row height: fixed, so the dots and cursors
// line up across rows.
const DOT_COL = 10;
const MAP_ROW = 20;

// The Pokémon's menu icon, Gen 2 party style: it hops while working, shivers
// while it waits on you, and sleeping it is dimmed and lies still.
function iconBox(a, mood, h = iconH()) {
  const w = (h * 4) / 3;
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

// One party card: the Pokémon's icon, then two rows (name top, space + model badge
// bottom) filling the card height with justify_between, and a thin HP bar straddling
// the card's bottom border line.
// Focused: inverted. Waiting on you: red border. Asleep: dimmed icon and name.
// Right-click: the icon chooses the Pokémon, the rest opens the agent's info.
// o.kids: how many sub-agents it has (a ▸/▾ count before the space name);
// o.open: they are shown; o.toggle: what a click on the focused card does.
// o.child: a sub-agent's card, smaller; a hidden one (no pane) shows a Poké
// Ball and has no info dialog (it isn't in agentList).
function slot(a, cardW, o = {}) {
  const hp = hpOf(a);
  const mood = moodOf(a);
  const kids = o.kids ?? 0;

  const nameEl = div()
    .min_w(0)
    .whitespace_normal()
    .max_h(Math.round(lhPx(TEXT) * 2))
    .overflow_hidden()
    .text_color(mood === "sleep" ? DARK : INK)
    .text_size(TEXT)
    .line_height(LH(TEXT))
    .child(agentName(a));

  const space = div()
    .flex_1()
    .min_w(0)
    .truncate()
    .text_size(SMALL)
    .font_family(FONT_SMALL)
    .line_height(LH(SMALL))
    .text_color(DARK)
    .child(a.space_name ?? "");

  // Sub-agents: "▸ 2" (hidden) or "▾ 2" (shown) before the space name.
  const fold = kids
    ? div()
      .flex_none()
      .text_size(SMALL)
      .font_family(FONT_SMALL)
      .line_height(LH(SMALL))
      .text_color(o.open ? M.mauve : M.overlay1)
      .child(`${o.open ? "▾" : "▸"} ${kids}`)
    : null;

  const bottomRow = h_flex()
    .items_end()
    .gap(6)
    .when(Boolean(fold), (e) => e.child(fold))
    .child(space)
    .child(modelBadge(a, MODEL_SIZE()));

  const info = v_flex()
    .flex_1()
    .min_w(0)
    .self_stretch()
    .justify_between()
    .child(nameEl)
    .child(bottomRow);

  const gap = 6;
  const row = h_flex()
    .items_stretch()
    .gap(gap)
    .child(iconBox(a, mood, o.child ? CHILD_ICON() : iconH()))
    .child(info);

  const inset = 10;
  const barW = Math.max(20, Math.round(cardW - inset * 2));
  const known = hp != null && Number.isFinite(Number(hp));
  const p = known ? Math.max(0, Math.min(100, Math.round(hp))) : 0;
  const fillW = p > 0 ? Math.max(1, Math.round((barW * p) / 100)) : 0;
  const fill = div().h_full().rounded(1).bg(hpColor(p)).w(fillW);
  let hpTrack = div()
    .absolute()
    .left(inset)
    .bottom(-2)
    .w(barW)
    .h(4)
    .rounded(1)
    .bg(M.surface2)
    .overflow_hidden()
    .flex()
    .child(fill);
  if (!known) hpTrack = hpTrack.opacity(0.5);
  if (known && p <= 20) hpTrack = hpTrack.loop("opacity", { from: 0.35, to: 1, period: 900 });

  let card = frame(row, { id: "pt-" + a.address, inverted: a.focused, pad: o.child ? CHILD_PAD : CARD_PAD, edge: mood === "alert" ? M.red : undefined })
    .flex_none()
    .relative()
    .child(hpTrack)
    .cursor_pointer()
    // A click shows the agent; on the agent already shown, it folds or
    // unfolds its sub-agents.
    .on_click((_e, cx) => {
      if (a.focused && kids && o.toggle) return o.toggle(cx);
      run("agent.focus", { terminal: a.address });
    });
  if (!a.hidden) {
    card = card.on_mouse_down("right", (_e, cx) => {
      cx.stop_propagation();
      openAgentInfo(a.address);
    });
  }
  return card;
}

// Sub-agents: live core terminals whose parent is an agent (or another
// sub-agent). One with a pane is an agentList agent; a hidden one (no pane,
// e.g. `hc run --bg` without a herdr label) is built from terminals() and
// takes its parent's town. Returns { kids: Map(parent -> [agent]), nested:
// Set of visible agents that sit under a parent instead of at the top }.
function subagentTree(all) {
  const visible = new Map(all.map((a) => [a.address, a]));
  const info = shared("pocket.info") ?? {};
  const terms = (terminals() ?? []).filter((t) => t?.address && t.parent && t.state === "live");
  const parentOf = new Map(terms.map((t) => [t.address, t.parent]));
  const isAgent = (t) => visible.has(t.address) || Boolean(t.agent || t.program?.agent || t.status);
  const nodes = new Map();
  for (const t of terms) if (isAgent(t)) nodes.set(t.address, t);
  // Its parent is shown: a top-level agent, or a sub-agent that is itself
  // rooted. (A visible agent whose parent is a plain shell stays top-level.)
  const rooted = (addr, depth = 0) => {
    const up = parentOf.get(addr);
    if (!up || depth > 8) return false;
    if (!nodes.has(up)) return visible.has(up);
    return rooted(up, depth + 1) || visible.has(up);
  };
  const kids = new Map();
  const nested = new Set();
  const made = new Map();
  const build = (t) => {
    if (made.has(t.address)) return made.get(t.address);
    let a = visible.get(t.address);
    if (!a) {
      const up = visible.get(t.parent) ?? (nodes.has(t.parent) ? build(nodes.get(t.parent)) : null);
      const st = ["working", "blocked", "done", "idle"].includes(t.status) ? t.status : "idle";
      a = {
        address: t.address, pane: null, tab: null, space: up?.space, space_name: up?.space_name ?? "",
        status: st, app: t.agent ?? null, program: t.program, title: t.name || t.title || "",
        session_name: info[t.address]?.name ?? null, model: info[t.address]?.model ?? null,
        focused: false, pinned: false, hidden: true,
      };
    }
    made.set(t.address, a);
    return a;
  };
  for (const t of nodes.values()) {
    if (!rooted(t.address)) continue;
    if (!kids.has(t.parent)) kids.set(t.parent, []);
    kids.get(t.parent).push(build(t));
    if (visible.has(t.address)) nested.add(t.address);
  }
  return { kids, nested };
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
// a fixed column when it has one. The small button in the TOWN MAP header row
// founds a new town (space): with other machines known it first opens the
// islands to choose from.
function mapSection(list, role) {
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
      .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); openTown(s.id); })
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
  if (role.choosing) {
    const ms = machines() ?? [];
    const names = [...new Set(["", ...ms.map((m) => m.name ?? "")])];
    const away = new Set(ms.filter((m) => m.layout === "unavailable").map((m) => m.name ?? ""));
    for (const k of names) {
      rows.push(
        h_flex()
          .id("sp-new-" + (k || "here"))
          .h(MAP_ROW)
          .items_center()
          .gap(4)
          .pl(14)
          .cursor_pointer()
          .text_color(away.has(k) ? M.overlay0 : M.green)
          .hover((st) => st.text_color(INK))
          .on_click((_e, cx) => {
            role.choosing = false;
            run("space.new", { machine: k });
            cx.notify();
          })
          .child(cursor(false))
          .child(islandIcon(k, 10))
          .child(div().flex_1().min_w(0).truncate().text_size(TEXT).line_height(LH(TEXT)).child(k ? tr(`ĐẢO ${k.toUpperCase()}`, `ISLAND ${k.toUpperCase()}`) : tr("MÁY NÀY", "THIS MACHINE"))),
      );
    }
  }
  const head = h_flex()
    .flex_none()
    .pt(6)
    .pb(2)
    .px(4)
    .items_center()
    .justify_between()
    .gap(4)
    .child(
      div()
        .text_size(TEXT)
        .line_height(`${TEXT + 4}px`)
        .text_color(M.yellow)
        .child(tr("BẢN ĐỒ", "TOWN MAP")),
    )
    .child(
      div()
        .id("sp-new")
        .flex_none()
        .px(5)
        .py(1)
        .rounded(3)
        .border(1)
        .border_color(M.surface2)
        .text_size(SMALL)
        .font_family(FONT_SMALL)
        .line_height(LH(SMALL))
        .text_color(M.overlay1)
        .cursor_pointer()
        .hover((st) => st.bg(M.surface1).text_color(INK).border_color(M.mauve))
        .on_click((_e, cx) => {
          const ms = machines() ?? [];
          if (ms.length <= 1) return run("space.new", { machine: "" });
          role.choosing = !role.choosing;
          cx.notify();
        })
        .child(role.choosing ? tr("+ ĐẢO NÀO?", "+ ISLAND?") : tr("+ THỊ TRẤN MỚI", "+ NEW TOWN")),
    );
  return v_flex()
    .flex_none()
    .gap(2)
    .child(head)
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

function findNode(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export default class Role {
  init(_props, _cx) {
    this.boxOpen = true;
    this.open = new Set(); // parents whose sub-agents are unfolded
    this.w = undefined;
  }

  // A card, and when unfolded its sub-agents below it, indented behind a
  // guide line with an elbow to each one (the last one's line stops there).
  card(a, w, kids, depth) {
    const list = depth < 4 ? kids.get(a.address) ?? [] : [];
    const isOpen = this.open.has(a.address);
    const el = slot(a, w, {
      kids: list.length,
      open: isOpen,
      child: depth > 0,
      toggle: (cx) => {
        if (isOpen) this.open.delete(a.address);
        else this.open.add(a.address);
        cx.notify();
      },
    });
    if (!list.length || !isOpen) return el;
    const line = M.surface2;
    const childW = w - CHILD_INDENT;
    const rows = list.map((k, i) => {
      const last = i === list.length - 1;
      const elbow = v_flex()
        .w(CHILD_INDENT)
        .flex_none()
        .pl(6)
        .child(div().h(6).flex_none().border_l(2).border_color(line))
        .child(div().flex_1().border_l(2).border_b(2).border_color(line))
        .child(div().flex_1().when(!last, (e) => e.border_l(2).border_color(line)));
      return h_flex()
        .flex_none()
        .items_stretch()
        .child(elbow)
        .child(v_flex().flex_1().min_w(0).pt(6).child(this.card(k, childW, kids, depth + 1)));
    });
    return v_flex().flex_none().child(el).children(rows);
  }

  render(_cx) {
    const all = agentList();
    // Sub-agents sit under their parent's card, not at the top.
    const { kids, nested } = subagentTree(all);
    const top = all.filter((a) => !nested.has(a.address));
    const tabs = new Map(spaces().flatMap((s) => s.tabs.map((t) => [t.id, t])));
    const settled = (a) => tabs.get(a.tab)?.settled === true;
    const open = top.filter((a) => !settled(a));
    const ordered = [...open.filter((a) => a.pinned), ...open.filter((a) => !a.pinned)];
    const party = ordered.slice(0, PARTY_MAX);
    // Party order with each card's sub-agents after it; a visible sub-agent
    // whose parent isn't in the party goes to the PC box.
    const tree = [];
    const walk = (a) => {
      if (tree.includes(a)) return;
      tree.push(a);
      for (const k of kids.get(a.address) ?? []) walk(k);
    };
    party.forEach(walk);
    const strays = all.filter((a) => nested.has(a.address) && !tree.includes(a));
    const box = [...ordered.slice(PARTY_MAX), ...top.filter(settled), ...strays];
    setAgentOrder([...tree.filter((a) => !a.hidden), ...box].map((a) => a.address));

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

    const cardW = (this.w ?? 300) - 16;
    const partyList = party.length
      ? v_flex().flex_none().gap(6).children(party.map((a) => this.card(a, cardW, kids, 0)))
      : frame(
          v_flex()
            .gap(2)
            .child(tr("Chưa có ai trong đội.", "No one in the party yet."))
            .child(div().text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(DARK).child(tr("Mở một agent để bắt đầu!", "Open an agent to begin!"))),
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
        .child(`${tr("HỘP PC", "PC BOX")} (${box.length}) ${this.boxOpen ? "−" : "+"}`);
      let boxSection = v_flex().flex_none().gap(4).child(head);
      if (this.boxOpen) boxSection = boxSection.child(v_flex().px(4).children(box.map(boxRow)));
      scroll.child(boxSection);
    }

    const bottomNode = findNode(layout(), "bottom");
    const bottomVisible = bottomNode ? !bottomNode.hidden : true;
    const bottomBtn = div()
      .id("party-bottom")
      .flex_none()
      .px(5)
      .py(1)
      .rounded(3)
      .border(1)
      .border_color(M.surface2)
      .text_size(SMALL)
      .font_family(FONT_SMALL)
      .line_height(LH(SMALL))
      .text_color(M.overlay1)
      .cursor_pointer()
      .hover((st) => st.bg(M.surface1).text_color(INK).border_color(M.mauve))
      .on_click((_e, cx) => {
        run("layout.toggle", { id: "bottom" });
        cx.notify();
      })
      .child(bottomVisible ? tr("▼ ẨN DƯỚI", "▼ HIDE BOTTOM") : tr("▲ HIỆN DƯỚI", "▲ SHOW BOTTOM"));

    const partyHead = h_flex()
      .flex_none()
      .pt(6)
      .pb(2)
      .px(4)
      .items_center()
      .justify_between()
      .gap(4)
      .child(
        div()
          .text_size(TEXT)
          .line_height(`${TEXT + 4}px`)
          .text_color(M.yellow)
          .child(tr("ĐỘI HÌNH", "PARTY")),
      )
      .child(bottomBtn);

    return root
      .child(partyHead)
      .child(scroll)
      .child(mapSection(spaces(), this));
  }
}
