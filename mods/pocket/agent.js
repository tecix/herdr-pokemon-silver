// Pocket role "agent": one agent's details, a dialog (kit openAgentInfo,
// right-click a party card anywhere but its Pokémon icon). Drawn like a Gen 2
// Pokémon summary screen: the Pokémon on the left, the agent's facts on the
// right, EXP, then the usage limits of its product on its machine (every
// window known: 5 hours, 7 days, a month...) with what's left and when each
// resets. Props: { address, overlay }. Live: the data re-reads every render,
// the countdowns tick every 30 s.
import { div } from "gpui-kit";
import { props, panes, home, run, closeOverlay } from "herdr";
import { monOf, monName, shinyOf, evolutionOf, infoOf } from "./mons.js";
import {
  frame, v_flex, h_flex, glyph, monFit, pokeball, bar, hpColor, M, INK, DARK, TEXT, SMALL, BIG, FONT_SMALL, FONT_BIG, LH, lhPx,
  agentList, agentName, modelBadge, condition, moodOf, STATUS, levelOf, EXP_PER_DONE, limitsOf, limitAccountOf, limitsAt,
  openPicker, openRename, paneName,
} from "./kit.js";

const LEAD = 112;
const LABEL_W = 132;
const BAR_W = 200;
const EFFORT_WORD = { minimal: "tối thiểu", low: "thấp", medium: "vừa", high: "cao", xhigh: "rất cao", max: "tối đa" };
const DAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const small = (el, color = DARK) => el.text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(color);
const pad2 = (n) => String(n).padStart(2, "0");

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

// "5h" -> "5 GIỜ", "7d:Opus" -> "7 NGÀY · OPUS", "month" -> "THÁNG".
function windowLabel(id) {
  const [span, extra] = String(id).split(":");
  const m = span.match(/^(\d+)([hdm])$/);
  const base = span === "month" ? "THÁNG"
    : m ? `${m[1]} ${{ h: "GIỜ", d: "NGÀY", m: "PHÚT" }[m[2]]}`
    : span.toUpperCase();
  return extra ? `${base} · ${extra.toUpperCase()}` : base;
}

// Time left as "4n 19g", "2g 22p", "15p".
function left(sec) {
  const s = Math.max(0, Math.round(sec));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}n ${h}g`;
  if (h) return `${h}g ${pad2(m)}p`;
  return `${Math.max(1, m)}p`;
}

// The reset time: "22:30" within a day, "T2 14:00" within a week, else "14/11 14:00".
function at(ts) {
  const d = new Date(ts * 1000);
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const ahead = ts - Date.now() / 1000;
  if (ahead < 86400) return hm;
  if (ahead < 6 * 86400) return `${DAYS[d.getDay()]} ${hm}`;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${hm}`;
}

function ago(ts) {
  const s = Date.now() / 1000 - ts;
  if (s < 90) return "vừa xong";
  return `${left(s)} trước`;
}

// A facts row: the label (yellow), then the value (text, or any element).
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

// One usage window: its name, the bar of what's left (HP colors), the
// percent left, and when it resets.
function limitRow(w) {
  const remaining = 100 - w.used;
  const now = Date.now() / 1000;
  const when = w.reset
    ? "đã reset"
    : w.resets_at
      ? `reset ${at(w.resets_at)} · còn ${left(w.resets_at - now)}`
      : "";
  return h_flex()
    .items_center()
    .gap(8)
    .min_h(lhPx(TEXT) + 4)
    .child(small(div().w(LABEL_W).flex_none(), M.yellow).child(windowLabel(w.id)))
    .child(bar("", remaining, BAR_W, { blink: true, h: 9 }))
    .child(div().w(56).flex_none().text_size(TEXT).line_height(LH(TEXT)).text_color(hpColor(remaining)).child(`${Math.round(remaining)}%`))
    .child(small(div().flex_1().min_w(0).truncate()).child(when));
}

// A small text button in the box style.
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
    // The countdowns and "updated ... ago" tick.
    cx.timer.every(30000, (cx) => cx.notify());
  }

  close() {
    const o = props()?.overlay;
    if (o) closeOverlay(o);
  }

  render(_cx) {
    const p = props() ?? {};
    const all = agentList();
    // No address (herdr-app check): the first agent, so the role still renders.
    const a = p.address ? all.find((x) => x.address === p.address) : all[0];
    if (!a) {
      return frame(
        v_flex().size_full().gap(8)
          .child(div().text_size(BIG).font_family(FONT_BIG).line_height(LH(BIG)).text_color(M.yellow).child("THÔNG TIN AGENT"))
          .child("Agent này đã rời đội.")
          .child(div().flex_1())
          .child(small(div(), M.overlay1).child("Esc để đóng")),
        { id: "agent-info", full: true, pad: 14 },
      );
    }

    const pane = panes().find((x) => x.pane === a.pane);
    const info = infoOf(a.address);
    const mood = moodOf(a);
    const dex = a.pane ? monOf(a.pane) : null;
    const shiny = a.pane ? shinyOf(a.pane) : false;
    const machine = a.address.includes("/") ? a.address.split("/")[0] : "";

    // Title: the agent's name, the dex number on the right.
    const top = h_flex()
      .items_center()
      .gap(8)
      .child(div().flex_1().min_w(0).truncate().text_size(BIG).font_family(FONT_BIG).line_height(LH(BIG)).text_color(M.yellow).child("THÔNG TIN AGENT"))
      .child(div().flex_none().text_size(TEXT).line_height(LH(TEXT)).text_color(DARK).child(dex ? `No.${String(dex).padStart(3, "0")}` : ""));

    // The Pokémon, standing on its shadow, its name under it.
    const portrait = v_flex()
      .flex_none()
      .w(LEAD + 24)
      .items_center()
      .gap(4)
      .child(
        div().w(LEAD).h(LEAD).relative().flex_none()
          .child(div().absolute().left(LEAD * 0.1).w(LEAD * 0.8).top(LEAD * 0.76).h(LEAD * 0.2).rounded_full().bg(M.surface1))
          .child(div().absolute().left(0).top(0).child(a.pane ? monFit(a.pane, "anim", LEAD, { align: "bottom" }) : div().w(LEAD).h(LEAD).flex().items_center().justify_center().child(pokeball(40)))),
      )
      .child(h_flex().gap(4).items_center()
        .child(div().text_size(TEXT).line_height(LH(TEXT)).text_color(INK).child(dex ? monName(dex) : "—"))
        .when(shiny, (e) => e.child(div().text_color(M.yellow).child("★"))))
      .when(Boolean(condition(mood, SMALL)), (e) => e.child(condition(mood, SMALL)));

    // The facts.
    const modelValue = a.model
      ? h_flex().items_center().gap(6)
        .child(modelBadge(a, TEXT, { full: true }))
        .when(Boolean(a.effort), (e) => e.child(small(div()).child(EFFORT_WORD[a.effort] ?? a.effort)))
      : small(div()).child("chưa đọc được");
    const where = [a.space_name, a.tab_name].filter(Boolean).join(" · ");
    const dir = pane?.cwd ? folder(pane.cwd) : "";
    const dirValue = h_flex().min_w(0).items_center().gap(6)
      .child(div().min_w(0).truncate().text_size(TEXT).line_height(LH(TEXT)).text_color(INK).child(dir || "—"))
      .when(Boolean(pane?.branch), (e) => e.child(
        h_flex().flex_none().max_w(160).gap(3).items_center().text_color(M.green)
          .child(glyph("branch", 10))
          .child(small(div().min_w(0).truncate(), M.green).child(pane.branch)),
      ));
    let facts = v_flex()
      .flex_1()
      .min_w(0)
      .child(row("TÊN", agentName(a)))
      .child(row("CHƯƠNG TRÌNH", a.program?.name ?? a.app ?? "—"))
      .child(row("MODEL", modelValue))
      .child(row("TRẠNG THÁI", STATUS[a.status]?.say ?? a.status ?? "—"))
      .child(row("SPACE · TAB", where || "—"))
      .child(row("THƯ MỤC", dirValue))
      .child(row("MÁY", machine || "máy này"))
      .child(row("TERMINAL", a.address));
    if (info?.session) {
      const kind = info.kind === "bg" ? "chạy nền" : "";
      facts = facts.child(row("SESSION", [info.name, info.session.slice(0, 8), kind].filter(Boolean).join(" · ")));
    }

    // EXP: the bar, the number, and what a full bar brings.
    const exp = levelOf(a.address).exp ?? 0;
    const next = dex ? evolutionOf(dex, a.pane) : null;
    const goal = next ? `tiến hóa thành ${monName(next)}` : shiny ? "đã tối đa ★" : "thành shiny ★";
    const expRow = h_flex()
      .items_center()
      .gap(8)
      .child(small(div().w(LABEL_W).flex_none(), M.yellow).child("EXP"))
      .child(bar("", exp, BAR_W, { fg: M.blue, h: 6 }))
      .child(div().w(56).flex_none().text_size(TEXT).line_height(LH(TEXT)).text_color(M.blue).child(`${exp}/100`))
      .child(small(div().flex_1().min_w(0).truncate()).child(`+${EXP_PER_DONE}/việc · đầy: ${goal}`));

    // The usage limits.
    const limits = limitsOf(a);
    const acct = limitAccountOf(a);
    const readAt = limitsAt(a);
    const limitsHead = h_flex()
      .items_center()
      .gap(8)
      .child(div().flex_none().text_size(TEXT).line_height(LH(TEXT)).text_color(M.yellow).child("GIỚI HẠN DÙNG"))
      .child(small(div().flex_1().min_w(0).truncate()).child(
        [a.program?.name, acct?.plan ? acct.plan.toUpperCase() : null, acct?.account].filter(Boolean).join(" · "),
      ));
    const limitRows = limits.length
      ? v_flex().gap(2).children(limits.map(limitRow))
      : small(div()).child(`Chưa có số liệu giới hạn cho ${a.program?.name ?? "agent này"}${machine ? " trên " + machine : ""}.`);

    const footer = h_flex()
      .items_center()
      .gap(6)
      .child(small(div().flex_1().min_w(0).truncate(), M.overlay1).child(
        [readAt ? `số liệu: ${ago(readAt)}` : null, acct?.failed && !limits.length ? acct.failed : null, "Esc để đóng"].filter(Boolean).join(" · "),
      ))
      .child(button("ai-go", "TỚI AGENT", () => { run("agent.focus", { terminal: a.address }); this.close(); }))
      .when(Boolean(a.pane), (e) => e
        .child(button("ai-mon", "ĐỔI POKÉMON", () => { this.close(); openPicker(a.pane); }))
        .child(button("ai-name", "ĐỔI TÊN", () => { this.close(); openRename(a.pane, paneName(a.pane)); })));

    const divider = () => div().h(2).flex_none().bg(M.surface1);
    const card = v_flex()
      .size_full()
      .gap(8)
      .child(top)
      .child(divider())
      .child(h_flex().gap(14).items_start().child(portrait).child(facts))
      .child(expRow)
      .child(divider())
      .child(limitsHead)
      .child(limitRows)
      .child(div().flex_1())
      .child(footer);

    return frame(card, { id: "agent-info", full: true, pad: 14 });
  }
}
