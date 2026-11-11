// Pocket role "dialog": the bottom text box, the game's message box. One copy
// only: it also watches agents (trackAgents) on every render.
import { div } from "gpui-kit";
import { run } from "herdr";
import { startLoader } from "./mons.js";
import { startGitLoot } from "./gitloot.js";
import { frame, h_flex, v_flex, FONT, TEXT, SMALL, BIG, DARK, INK, M, agentName, events, eventText, trackAgents, glyph, blink, mon, monFit, pokeball, agentList, FONT_SMALL, LH, FONT_BIG, monNameOf, hpOf, bar, cursor, markRead, unreadCount, openInbox, dismissEvent, tr } from "./kit.js";

const PIC = 64; // the Pokémon's box, on the left of the text (Gen 3 art 64px)
const INTRO = 900; // the encounter's flash, ms, before the text types

// Time since `at`.
function ago(at) {
  const min = Math.floor((Date.now() - at) / 60000);
  if (min < 1) return tr("vừa xong", "just now");
  if (min < 60) return tr(`${min} phút trước`, `${min}m ago`);
  return tr(`${Math.floor(min / 60)} giờ trước`, `${Math.floor(min / 60)}h ago`);
}

// Event kind -> the pill's words and color (Gen 2 tag look). A "blocked" event
// whose agent no longer waits shows PAST instead.
function pillOf(kind, past) {
  if (past) return [tr("ĐÃ QUA", "PAST"), M.overlay1];
  if (kind === "evolve") return [tr("TIẾN HÓA!", "EVOLVED!"), M.yellow];
  if (kind === "shiny") return ["SHINY!", M.pink];
  if (kind === "blocked") return [tr("CHỜ", "WAIT"), M.red];
  if (kind === "done") return [tr("XONG", "DONE"), M.green];
  return null;
}

function pill(text, bg) {
  return div()
    .flex_none()
    .px(4)
    .rounded(8)
    .bg(bg)
    .text_color(M.crust)
    .text_size(SMALL).font_family(FONT_SMALL)
    .line_height(LH(SMALL))
    .child(text);
}

export default class Role {
  init(_props, cx) {
    startLoader(cx); // the one copy that fetches Pokémon art (mons.js)
    startGitLoot(cx); // each town's git state -> shared pocket.git (gitloot.js)
    this.memo = {};
    this.index = 0; // 0 = newest event
    this.msgKey = null; // the message on screen (id + text)
    this.shown = 0; // characters of it typed so far
    this.total = 0; // characters in it
    this.fled = new Set(); // blocked agents whose encounter you ran from (until they stop waiting)
    this.introUntil = 0; // the encounter's flash runs until then
    this.choice = 0; // the encounter menu's cursor: 0 TRẢ LỜI, 1 CHẠY
    // Typewriter: 2 characters per tick while a message is being typed; idle
    // ticks do nothing (no redraw). Started here: tasks need init's context.
    cx.timer.every(30, (cx) => {
      if (this.introUntil) {
        if (Date.now() < this.introUntil) return;
        this.introUntil = 0;
        cx.notify();
        return;
      }
      if (this.shown >= this.total) return;
      this.shown = Math.min(this.total, this.shown + 2);
      cx.notify();
    });
  }

  render(cx) {
    trackAgents(this.memo);
    const list = events();
    const all = agentList();
    const waiting = all.filter((a) => a.status === "blocked");
    for (const k of [...this.fled]) if (!waiting.some((a) => a.address === k)) this.fled.delete(k);
    if (this.index >= list.length) this.index = Math.max(0, list.length - 1);

    // An agent waiting on you is an encounter (unless you ran from it, or are
    // browsing older events).
    const foe = this.index === 0 ? waiting.find((a) => !this.fled.has(a.address)) : null;
    if (foe) return this.encounter(foe, waiting.length);
    this.encKey = null;

    // Else the chosen event.
    let text;
    let id;
    let address = null;
    let at = null;
    let kind = null;
    if (list.length) {
      const e = list[this.index];
      text = eventText(e);
      id = e.id;
      address = e.address ?? null;
      at = e.at;
      kind = e.kind ?? null;
    } else {
      text = all.length
        ? tr(
            `Chào mừng! Đội của bạn có ${all.length} thành viên.`,
            `Welcome! Your party has ${all.length} member${all.length === 1 ? "" : "s"}.`,
          )
        : tr(
            "Chào mừng! Mở một agent để bắt đầu hành trình.",
            "Welcome! Open an agent to start your journey.",
          );
      id = "welcome";
    }

    // Typewriter: a new message (or new text) starts typing from nothing.
    const chars = Array.from(text);
    const key = `${id}\n${text}`;
    if (this.msgKey !== key) {
      this.msgKey = key;
      this.shown = 0;
      this.total = chars.length;
    }
    const typed = chars.slice(0, this.shown).join("");

    // The message's Pokémon, left of the text: animated while something is
    // happening (level up, blocked). Welcome has none; no agent = a Poké Ball.
    const who = address ? all.find((a) => a.address === address) : null;
    const pane = who?.pane;
    const lively = kind === "evolve" || kind === "shiny" || who?.status === "blocked";
    let picture = null;
    if (id !== "welcome") {
      picture = div()
        .w(PIC)
        .h(PIC)
        .flex_none()
        .flex()
        .items_center()
        .justify_center()
        .child(pane ? mon(pane, lively ? "anim" : "front", PIC) : pokeball(28));
    }

    const unread = unreadCount();
    const meta = [at != null ? ago(at) : null, list.length ? `${this.index + 1}/${list.length}` : null, unread ? tr(`${unread} chưa đọc`, `${unread} unread`) : null]
      .filter(Boolean)
      .join("  ·  ");

    let message = div().text_size(BIG).font_family(FONT_BIG).line_height(LH(BIG)).text_color(INK).child(typed);
    if (address) {
      message = message.id("dlg-msg").on_click((_e, cx) => {
        cx.stop_propagation();
        markRead(id);
        run("agent.focus", { terminal: address });
      });
    }

    // The meta line opens the notification list (inbox).
    let metaRow = h_flex()
      .id("dlg-meta")
      .items_center()
      .gap(6)
      .min_w(0)
      .cursor_pointer()
      .on_click((_e, cx) => { cx.stop_propagation(); openInbox(); })
      .child(div().min_w(0).truncate().text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(DARK).child(meta));
    const tag = pillOf(kind, kind === "blocked" && who?.status !== "blocked");
    if (tag) metaRow = metaRow.child(pill(tag[0], tag[1]));

    const column = v_flex()
      .flex_1()
      .min_w(0)
      .min_h(0)
      .justify_center()
      .gap(2)
      .child(message)
      .child(metaRow);

    let row = h_flex().size_full().gap(8).items_center();
    if (picture) row = row.child(picture);
    row = row.child(column);
    if (this.index + 1 < list.length) {
      row = row.child(
        div()
          .id("dlg-next")
          .flex_none()
          .text_size(BIG).font_family(FONT_BIG)
          .text_color(M.text)
          .p(4).child(blink(glyph("more", 14)))
          .on_click((_e, cx) => {
            cx.stop_propagation();
            this.index = Math.min(this.index + 1, Math.max(0, events().length - 1));
            cx.notify();
          }),
      );
    }

    // A click on the box itself (not on the message or the arrow) goes back to
    // the newest event, but only from the oldest one. A right-click dismisses
    // the event on screen (the next older one shows, or the welcome).
    let box = frame(row, { id: "dlg", full: true, size: BIG, pad: 8 })
      .font_family(FONT)
      .on_click((_e, cx) => {
        const n = events().length;
        if (this.index > 0 && this.index + 1 >= n) {
          this.index = 0;
          cx.notify();
        }
      });
    if (id !== "welcome") {
      box = box.on_mouse_down("right", (_e, cx) => {
        cx.stop_propagation();
        dismissEvent(id);
        cx.notify();
      });
    }
    return box;
  }

  // The encounter, Gen 2 style: the screen flashes, the Pokémon slides in on
  // its platform with its HP box, "MACHOKE hoang dã xuất hiện!" types out,
  // then a menu: TRẢ LỜI (go to the agent) or CHẠY (back to the events until
  // it waits again). More than one waiting: the first, and how many more.
  encounter(foe, count) {
    const foeName = foe.pane ? monNameOf(foe.pane) : agentName(foe).toUpperCase();
    const title = tr(`${foeName} hoang dã xuất hiện!`, `Wild ${foeName} appeared!`);
    const key = `enc-${foe.address}\n${title}`;
    if (this.encKey !== key) {
      this.encKey = key;
      this.msgKey = key;
      this.introUntil = Date.now() + INTRO;
      this.shown = 0;
      this.choice = 0;
    }
    const chars = Array.from(title);
    this.total = chars.length;
    const intro = this.introUntil > 0;
    const typed = intro ? "" : chars.slice(0, this.shown).join("");
    const ready = !intro && this.shown >= this.total;

    const answer = () => run("agent.focus", { terminal: foe.address });
    const flee = (cx) => {
      this.fled.add(foe.address);
      this.encKey = null;
      cx.notify();
    };

    // The Pokémon on a platform, sliding in from the left after the flash.
    const art = foe.pane ? monFit(foe.pane, "anim", PIC, { align: "bottom" }) : pokeball(28);
    const stage = div()
      .relative()
      .w(PIC)
      .h(PIC)
      .flex_none()
      .overflow_hidden()
      .child(div().absolute().left(PIC * 0.08).w(PIC * 0.84).top(PIC * 0.78).h(PIC * 0.2).rounded_full().bg(M.surface1))
      .child(div().id("enc-mon").absolute().top(0).w(PIC).h(PIC).left(intro ? -PIC : 0).transition("left", { duration: 450, easing: "ease-out" }).child(art));
    const left = v_flex().flex_none().items_center().gap(2).child(stage).child(bar("", hpOf(foe), PIC - 22, { blink: true, h: 6 }));

    const option = (i, label, act) => h_flex()
      .id(`enc-opt-${i}`)
      .flex_none()
      .items_center()
      .cursor_pointer()
      .child(cursor(this.choice === i))
      .child(div().text_size(TEXT).font_family(FONT).line_height(LH(TEXT)).text_color(this.choice === i ? INK : DARK).child(label))
      .on_hover((h, cx) => { if (h && this.choice !== i) { this.choice = i; cx.notify(); } })
      .on_click((_e, cx) => { cx.stop_propagation(); act(cx); });

    const more = count > 1 ? tr(`  ·  còn ${count - 1} agent chờ nữa`, `  ·  ${count - 1} more waiting`) : "";
    const column = v_flex()
      .flex_1()
      .min_w(0)
      .justify_center()
      .gap(2)
      .child(div().text_size(BIG).font_family(FONT_BIG).line_height(LH(BIG)).text_color(INK).child(typed || " "))
      .child(div().min_w(0).truncate().text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(DARK)
        .child(ready ? tr(`${agentName(foe)} đang chờ bạn trả lời${more}`, `${agentName(foe)} is waiting for your reply${more}`) : " "))
      .child(h_flex().gap(14).items_center().opacity(ready ? 1 : 0)
        .child(option(0, tr("TRẢ LỜI", "REPLY"), () => answer()))
        .child(option(1, tr("CHẠY", "RUN"), (cx) => flee(cx))));

    let body = h_flex().relative().size_full().gap(10).items_center().child(left).child(column);
    // The flash: the box blinks light before the Pokémon shows.
    if (intro) body = body.child(div().absolute().left(0).top(0).size_full().bg(M.text).loop("opacity", { from: 0, to: 0.85, period: 220 }));

    // A right-click anywhere on the box runs, like CHẠY.
    return frame(body, { id: "dlg", full: true, size: BIG, pad: 8, edge: M.red })
      .font_family(FONT)
      .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); flee(cx); });
  }
}
