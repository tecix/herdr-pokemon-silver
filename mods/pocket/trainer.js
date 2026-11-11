// Pocket role "trainer": the trainer card (MENU > THẺ TRAINER), a dialog.
// Gen 2 card layout: name and ID, jobs done, Pokédex, play time, the lead
// Pokémon on the right; the badge case and the party below.
// Data: kit trainer() (shared "pocket.trainer", kept by trackAgents), badges
// (shared "pocket.badges"), agentList(). The name is git's user.name, else
// the home folder's name.
import { div } from "gpui-kit";
import { exec, home } from "herdr";
import { COUNT } from "./mons.js";
import {
  frame, v_flex, h_flex, glyph, mon, monFit, pokeball, M, INK, DARK, TEXT, SMALL, BIG, FONT, FONT_SMALL, FONT_BIG, LH,
  trainer, agentList, agentName, monNameOf, BADGE_SLOTS, BADGE_COLORS, badgeCount, crisp, tr,
} from "./kit.js";

const LEAD = 128; // Gen 3 art (64px doubled)

function idNo(name) {
  let h = 7;
  for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) % 65536;
  return String(h).padStart(5, "0");
}

// Play time, Gen 2 style "hh:mm" (hours keep going past 99).
function playTime(since) {
  const min = Math.max(0, Math.floor((Date.now() - (since ?? Date.now())) / 60000));
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
}

function stat(label, value) {
  return h_flex()
    .items_center()
    .h(Math.round(TEXT * 1.5))
    .child(div().w(130).flex_none().text_size(TEXT).line_height(LH(TEXT)).text_color(M.yellow).child(label))
    .child(div().flex_1().min_w(0).truncate().text_size(BIG).font_family(FONT_BIG).line_height(LH(BIG)).text_color(INK).child(value));
}

export default class Role {
  init(_props, cx) {
    this.name = (home().split("/").filter(Boolean).pop() ?? "TRAINER").toUpperCase();
    cx.spawn(async (cx) => {
      const r = await exec("git", ["config", "--global", "user.name"]).catch(() => null);
      const n = r?.code === 0 ? r.stdout.trim() : "";
      if (n) { this.name = n.toUpperCase(); cx.notify(); }
    });
    // The play time ticks.
    cx.timer.every(30000, (cx) => cx.notify());
  }

  render(_cx) {
    const t = trainer();
    const party = agentList();
    const lead = party.find((a) => a.focused) ?? party[0];
    const seen = Object.keys(t.dex ?? {}).length;
    const earned = badgeCount();

    const top = h_flex()
      .items_center()
      .child(div().flex_1().text_size(BIG).font_family(FONT_BIG).line_height(LH(BIG)).text_color(M.yellow).child(tr("THẺ TRAINER", "TRAINER CARD")))
      .child(div().text_size(TEXT).line_height(LH(TEXT)).text_color(DARK).child(`ID No. ${idNo(this.name)}`));

    const stats = v_flex()
      .flex_1()
      .min_w(0)
      .child(stat(tr("TÊN/", "NAME/"), this.name))
      .child(stat(tr("VIỆC XONG", "JOBS DONE"), String(t.jobs ?? 0)))
      .child(stat("POKÉDEX", `${seen} / ${COUNT}`))
      .child(stat(tr("THỜI GIAN", "PLAY TIME"), playTime(t.since)));

    const portrait = v_flex()
      .flex_none()
      .items_center()
      .gap(2)
      .child(
        div().w(LEAD).h(LEAD).relative().flex_none()
          .child(div().absolute().left(LEAD * 0.1).w(LEAD * 0.8).top(LEAD * 0.76).h(LEAD * 0.2).rounded_full().bg(M.surface1))
          .child(div().absolute().left(0).top(0).child(lead?.pane ? monFit(lead.pane, "anim", LEAD, { align: "bottom" }) : div().w(LEAD).h(LEAD).flex().items_center().justify_center().child(pokeball(40)))),
      )
      .child(div().max_w(LEAD + 20).truncate().text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(DARK)
        .child(lead ? `${lead.pane ? monNameOf(lead.pane) : ""} · ${agentName(lead)}` : tr("chưa có Pokémon", "no Pokémon yet")));

    let badgeRow = h_flex().gap(10).items_center();
    for (let i = 0; i < BADGE_SLOTS; i++) {
      badgeRow = badgeRow.child(
        div().flex_none().text_color(i < earned ? BADGE_COLORS[i] : M.surface2).child(glyph(i < earned ? "badge" : "badge-empty", 18)),
      );
    }
    const iconH = crisp(30, 46);
    const partyRow = h_flex().gap(10).items_center().children(
      party.slice(0, 6).map((a) => div().w((iconH * 4) / 3).h(iconH).flex_none().child(a.pane ? mon(a.pane, "icon", iconH) : pokeball(14))),
    );
    const section = (label, content) => h_flex()
      .items_center()
      .gap(12)
      .child(div().w(100).flex_none().text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(DARK).child(label))
      .child(content);

    const card = v_flex()
      .size_full()
      .gap(10)
      .child(top)
      .child(div().h(2).bg(M.surface1))
      .child(h_flex().gap(16).items_center().child(stats).child(portrait))
      .child(div().h(2).bg(M.surface1))
      .child(section(tr("HUY HIỆU", "BADGES"), badgeRow))
      .child(section(tr("ĐỘI HÌNH", "PARTY"), partyRow))
      .child(div().flex_1())
      .child(div().text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(M.overlay1).child(tr("Esc để đóng", "Esc to close")));

    return frame(card, { id: "trainer", full: true, pad: 14 });
  }
}
