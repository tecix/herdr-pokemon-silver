// Pocket role "header": drawn on top of every pane, 30px tall, one copy per pane.
// Props from the app: { pane, terminal }. Click: focus the pane. Right-click:
// rename the pane (kit openRename; the Pokémon is picked from the party card).
// On hover: the split, zoom and close buttons.
// Look: a Gen 2 battle status box in the kit's colors.

import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, props, run, home } from "herdr";
import { FONT, TEXT, SMALL, M, INK, DARK, PAPER, SELECT, FOCUS, sprite, spriteKey, pokeballStill, mon, monNameOf, levelOf, hpOf, bar, glyph, openRename, paneName, agentName, moodOf, moodBubble, agentList, modelBadge, condition, FONT_SMALL, LH } from "./kit.js";

// Gaps and sizes, shared by both headers so the items line up the same way.
const GAP = 6;
const ICON = 28; // 40x30 menu icon at 28 tall: the strip is 30 minus its 2px bottom border
const ICON_W = Math.round(ICON * 4 / 3);

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

// A 22px square button. `hover` gives its colors on hover.
function button(child, id, command, args, hover = { bg: M.surface1, fg: INK }) {
  return div()
    .id(id)
    .w(22)
    .h(22)
    .flex()
    .flex_none()
    .justify_center()
    .items_center()
    .border(1)
    .border_color(M.surface2)
    .rounded(3)
    .text_color(INK)
    .text_size(SMALL).font_family(FONT_SMALL)
    .hover((s) => s.bg(hover.bg).text_color(hover.fg))
    .on_click((_e, cx) => {
      cx.stop_propagation();
      run(command, args);
    })
    .child(child);
}

// The Pokémon picture: a relative box so it can bob. Working: bobs like the
// Gen 2 party icons. Sleeping: half faded.
function icon(a, pane) {
  const mood = moodOf(a);
  let box = div()
    .relative()
    .w(ICON_W)
    .h(ICON)
    .flex_none()
    .flex()
    .items_center()
    .justify_center()
    .child(mon(pane, "icon", ICON));
  if (mood === "walk") box = box.loop("top", { from: 0, to: -3, period: 400 });
  if (mood === "sleep") box = box.opacity(0.5);
  return box;
}

// The agent's line, left to right: Pokémon, agent name (its session's name),
// product icon + model · effort (small), HP bar, status condition, Pokémon name (small).
function agentKids(a, pane) {
  const mood = moodOf(a);
  const kids = [icon(a, pane)];
  kids.push(div().min_w(0).max_w(420).truncate().text_size(TEXT).line_height(LH(TEXT)).text_color(INK).child(agentName(a)));
  kids.push(modelBadge(a, SMALL, { full: true }));
  kids.push(bar("", hpOf(a), 80, { blink: true }));
  const tag = condition(mood, SMALL);
  if (tag) kids.push(tag);
  kids.push(div().flex_none().text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(DARK).child(monNameOf(pane)));
  return kids;
}

// The shell's line: a Poké Ball for a plain terminal (else its program's
// sprite), its name, the folder, the git branch.
function shellKids(p) {
  const kids = [
    spriteKey(p.program) === "shell" ? pokeballStill(20) : sprite(p.program, 20),
    div().flex_none().text_size(TEXT).line_height(LH(TEXT)).child(paneName(p.pane) || p.program?.name || p.title || "SHELL"),
    div().min_w(0).max_w(260).truncate().text_size(TEXT).line_height(LH(TEXT)).text_color(DARK).child(folder(p.cwd)),
  ];
  if (p.branch) {
    kids.push(h_flex()
      .flex_none()
      .max_w(160)
      .gap(3)
      .items_center()
      .text_color(M.green)
      .child(glyph("branch", 10))
      .child(div().min_w(0).truncate().child(p.branch)));
  }
  return kids;
}

export default class Role {
  init(_props, _cx) { this.hovered = false; }

  render(cx) {
    const pane = props()?.pane;
    const p = panes().find((x) => x.pane === pane);
    if (!p) return div();

    const focused = Boolean(p.focused);
    // An agent: the agentList() entry for this pane when there is one. A pane
    // whose status is missing still counts when the app says it is an agent.
    const listed = agentList().find((x) => x.pane === p.pane);
    const isAgent = !p.mod && (p.status != null || Boolean(listed) || Boolean(p.program?.agent));
    const a = isAgent && !p.mod
      ? listed ?? { address: p.terminal, pane: p.pane, tab: p.tab, title: p.title, status: p.status, program: p.program }
      : null;

    let kids;
    if (p.mod) kids = [div().flex_1().min_w(0).truncate().child(paneName(p.pane) || p.title)];
    else if (a) kids = agentKids(a, p.pane);
    else kids = shellKids(p);

    const buttons = this.hovered
      ? [
        button(">", `ph-r-${pane}`, "pane.split", { direction: "right", pane }),
        button("v", `ph-d-${pane}`, "pane.split", { direction: "down", pane }),
        button(glyph("zoom", 10), `ph-z-${pane}`, "pane.zoom", { pane }),
        button("X", `ph-x-${pane}`, "pane.close", { pane }, { bg: M.red, fg: M.crust }),
      ]
      : [];

    let root = h_flex()
      .id("ph-" + pane)
      .size_full()
      .items_center()
      .overflow_hidden()
      .px(6)
      .gap(GAP)
      .font_family(FONT)
      .text_size(TEXT)
      .line_height(LH(TEXT))
      .bg(focused ? SELECT : PAPER)
      .text_color(INK)
      .border_b(2)
      .border_color(focused ? FOCUS : M.surface2)
      .on_hover((h, cx) => { this.hovered = h; cx.notify(); })
      .on_click(() => run("pane.focus", { pane }));

    root = root.on_mouse_down("right", (_e, cx) => {
      cx.stop_propagation();
      openRename(pane, paneName(pane));
    });

    return root
      .children(kids)
      .child(div().flex_1())
      .children(buttons);
  }
}
