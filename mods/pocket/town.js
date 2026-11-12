// Pocket role "town": one town's details, a dialog (kit openTown,
// right-click a town row in the sidebar TOWN MAP or a town on the map).
// Props: { space, overlay }.
import { div } from "gpui-kit";
import { props, spaces, panes, home, run, closeOverlay } from "herdr";
import { islandIcon } from "./scene.js";
import { islandTypeIcon, islandType, typeName } from "./types.js";
import { lootChips } from "./gitloot.js";
import {
  frame, v_flex, h_flex, mon, pokeball, M, INK, DARK, TEXT, SMALL, BIG, FONT, FONT_SMALL, FONT_BIG, LH, lhPx,
  STATUS_COLOR, STATUS, agentList, agentName, tr,
} from "./kit.js";

const LABEL_W = 120;
const small = (el, color = DARK) => el.text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(color);

function folderName(cwd) {
  if (!cwd) return "~";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

function row(label, value) {
  const v = typeof value === "string" || typeof value === "number"
    ? div().flex_1().min_w(0).truncate().text_size(TEXT).line_height(LH(TEXT)).text_color(INK).child(String(value))
    : h_flex().flex_1().min_w(0).items_center().gap(6).child(value);
  return h_flex()
    .items_center()
    .min_h(lhPx(TEXT) + 4)
    .child(small(div().w(LABEL_W).flex_none(), M.yellow).child(label))
    .child(v);
}

function button(id, text, onClick) {
  return div()
    .id(id)
    .flex_none()
    .px(8)
    .h(lhPx(SMALL) + 8)
    .flex()
    .items_center()
    .border(1)
    .border_color(M.surface2)
    .rounded(3)
    .cursor_pointer()
    .hover((s) => s.bg(M.surface1))
    .text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(INK)
    .on_click((_e, cx) => {
      cx.stop_propagation();
      onClick();
    })
    .child(text);
}

export default class Role {
  init(_props, cx) {
    this.focus = cx.focus_handle();
    cx.timer.after(0, () => this.focus.focus());
  }

  close() {
    const o = props()?.overlay;
    if (o) closeOverlay(o);
  }

  render(_cx) {
    const p = props() ?? {};
    const all = spaces() ?? [];
    // No space (herdr-app check): the first space, so the role still renders.
    const s = p.space ? all.find((x) => x.id === p.space) : all[0];
    if (!s) {
      return frame(
        v_flex().size_full().gap(8)
          .child(div().text_size(BIG).font_family(FONT_BIG).line_height(LH(BIG)).text_color(M.yellow).child(tr("THỊ TRẤN", "TOWN")))
          .child(div().text_size(TEXT).text_color(INK).child(tr("Thị trấn không tồn tại.", "Town does not exist.")))
          .child(div().flex_1())
          .child(small(div(), M.overlay1).child(tr("Esc để đóng", "Esc to close"))),
        { id: "town-card", full: true, pad: 14 },
      );
    }

    // Title: town name uppercase + status square (STATUS_COLOR)
    const color = (s.status && STATUS_COLOR[s.status]) || M.surface2;
    let statusSquare = div().w(12).h(12).flex_none().rounded(2).bg(color);
    if (s.status === "blocked") {
      statusSquare = statusSquare.loop("opacity", { from: 0.4, to: 1, period: 800 });
    }

    const top = h_flex()
      .items_center()
      .gap(8)
      .child(islandTypeIcon(s.machine ?? "", 20))
      .child(div().flex_1().min_w(0).truncate().text_size(BIG).font_family(FONT_BIG).line_height(LH(BIG)).text_color(M.yellow).child(s.name.toUpperCase()))
      .child(statusSquare);

    // Island facts
    const islandName = s.machine || tr("MÁY NÀY", "THIS MACHINE");
    const islandValue = h_flex().items_center().gap(6)
      .child(islandIcon(s.machine, 12))
      .child(div().text_size(TEXT).line_height(LH(TEXT)).text_color(INK).child(islandName))
      .child(islandTypeIcon(s.machine ?? "", 14))
      .child(div().text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(DARK).child(typeName(islandType(s.machine ?? ""))));

    // Folder
    const tabIds = new Set((s.tabs ?? []).map((t) => t.id));
    const allPanes = panes() ?? [];
    const termPane = allPanes.find((p) => p.terminal && p.cwd && tabIds.has(p.tab));
    const folderPath = folderName(s.folder || termPane?.cwd || "");

    // Git loot chips
    const loot = lootChips(s.id, SMALL);

    let facts = v_flex()
      .flex_none()
      .gap(2)
      .child(row(tr("ĐẢO", "ISLAND"), islandValue))
      .child(row(tr("THƯ MỤC", "FOLDER"), folderPath));
    if (loot) {
      facts = facts.child(row("GIT", loot));
    }

    // Tabs list (name, count of terminals)
    const tabs = s.tabs ?? [];
    const tabsHeader = h_flex()
      .items_center()
      .gap(8)
      .child(div().flex_none().text_size(TEXT).line_height(LH(TEXT)).text_color(M.yellow).child(tr("CÁC TAB", "TABS")))
      .child(small(div().flex_1().min_w(0).truncate()).child(String(tabs.length)));

    const tabItems = tabs.length
      ? tabs.map((t) => {
          const termCount = allPanes.filter((p) => p.tab === t.id && Boolean(p.terminal)).length;
          const termLabel = tr(`${termCount} terminal`, `${termCount} terminal${termCount === 1 ? "" : "s"}`);
          return h_flex()
            .items_center()
            .justify_between()
            .gap(8)
            .min_h(lhPx(TEXT) + 2)
            .child(
              h_flex().items_center().gap(6).min_w(0).truncate()
                .child(div().w(6).h(6).flex_none().rounded(3).bg(t.active ? M.mauve : M.surface2))
                .child(div().truncate().text_size(TEXT).line_height(LH(TEXT)).text_color(INK).child(t.name || String(t.index)))
            )
            .child(small(div().flex_none(), DARK).child(termLabel));
        })
      : [small(div()).child(tr("Chưa có tab nào.", "No tabs."))];

    // Agents in this space
    const agents = agentList().filter((a) => a.space === s.id);
    const agentsHeader = h_flex()
      .items_center()
      .gap(8)
      .child(div().flex_none().text_size(TEXT).line_height(LH(TEXT)).text_color(M.yellow).child(tr("AGENTS", "AGENTS")))
      .child(small(div().flex_1().min_w(0).truncate()).child(String(agents.length)));

    const iconH = 20;
    const agentItems = agents.length
      ? agents.map((a) => {
          const statusText = STATUS[a.status]?.say ?? a.status ?? "—";
          const statusCol = STATUS_COLOR[a.status] ?? DARK;
          return h_flex()
            .id(`town-agent-${a.address}`)
            .items_center()
            .justify_between()
            .gap(8)
            .min_h(iconH + 4)
            .px(4)
            .py(1)
            .rounded(3)
            .cursor_pointer()
            .hover((st) => st.bg(M.surface1))
            .on_click((_e, cx) => {
              cx.stop_propagation();
              run("agent.focus", { terminal: a.address });
              this.close();
            })
            .child(
              h_flex().items_center().gap(6).min_w(0).truncate()
                .child(div().w((iconH * 4) / 3).h(iconH).flex_none().child(a.pane ? mon(a.pane, "icon", iconH) : pokeball(10)))
                .child(div().truncate().text_size(TEXT).line_height(LH(TEXT)).text_color(INK).child(agentName(a)))
            )
            .child(small(div().flex_none(), statusCol).child(statusText));
        })
      : [small(div()).child(tr("Không có agent nào trong thị trấn này.", "No agents in this town."))];

    // Footer buttons
    const footer = h_flex()
      .items_center()
      .gap(6)
      .child(small(div().flex_1().min_w(0).truncate(), M.overlay1).child(tr("Esc để đóng", "Esc to close")))
      .child(button("town-go", tr("ĐI", "GO"), () => {
        run("space.select", { id: s.id });
        this.close();
      }))
      .child(button("town-close", tr("ĐÓNG", "CLOSE"), () => {
        this.close();
      }));

    const divider = () => div().h(2).flex_none().bg(M.surface1);

    const body = v_flex()
      .flex_1()
      .min_h(0)
      .gap(8)
      .overflow_y_scrollbar()
      .pr(2)
      .child(facts)
      .child(divider())
      .child(v_flex().gap(4).child(tabsHeader).children(tabItems))
      .child(divider())
      .child(v_flex().gap(4).child(agentsHeader).children(agentItems));

    const card = v_flex()
      .size_full()
      .gap(8)
      .child(top)
      .child(divider())
      .child(body)
      .child(footer);

    return frame(card, { id: "town-card", full: true, pad: 14 })
      .font_family(FONT)
      .track_focus(this.focus)
      .on_key_down((e, cx) => {
        if (e.key === "escape") {
          cx.stop_propagation();
          this.close();
        }
      });
  }
}
