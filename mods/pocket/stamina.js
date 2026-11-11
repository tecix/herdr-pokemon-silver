// Pocket role "stamina": weekly usage across all models and products (Claude,
// Codex, Antigravity Gemini & Other models, OpenCode), opened by the top bar's
// STAMINA / THỂ LỰC button (kit openStamina).
import { div } from "gpui-kit";
import { props, shared, setShared, run, closeOverlay } from "herdr";
import {
  frame, v_flex, h_flex, sprite, bar, hpColor, M, INK, DARK, FONT, TEXT, SMALL, BIG, FONT_SMALL, FONT_BIG, LH, lhPx,
  limitsForProduct, productAccountOf, isEn, tr,
} from "./kit.js";
import { windowLabel, left, ago } from "./agent.js";

const PRODUCTS = [
  { key: "claude", name: "CLAUDE CODE" },
  { key: "codex", name: "CODEX" },
  { key: "antigravity", name: "ANTIGRAVITY" },
  { key: "opencode", name: "OPENCODE" },
];

const LABEL_W = 144;
const BAR_W = 150;

const small = (el, color = DARK) => el.text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(color);

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
      onClick(cx);
    })
    .child(text);
}

function rowLabel(key, wid) {
  if (key === "antigravity") {
    if (wid === "7d:Gemini") return tr("GEMINI · TUẦN", "GEMINI · WEEKLY");
    if (wid === "5h:Gemini") return tr("GEMINI · 5 GIỜ", "GEMINI · 5-HOUR");
    if (wid === "7d:Other") return tr("CLAUDE & GPT · TUẦN", "CLAUDE & GPT · WEEKLY");
    if (wid === "5h:Other") return tr("CLAUDE & GPT · 5 GIỜ", "CLAUDE & GPT · 5-HOUR");
    if (wid === "7d:Argon") return tr("ARGON 4 · TUẦN", "ARGON 4 · WEEKLY");
  }
  return windowLabel(wid);
}

function fiveMatchFor(lims, wid) {
  if (wid.startsWith("5h")) return null;
  const [, extra] = String(wid).split(":");
  if (extra) {
    const m = lims.find((w) => w.id === `5h:${extra}`);
    if (m) return m;
  }
  return lims.find((w) => w.id === "5h") ?? null;
}

function staminaRow(key, w, five, showAll) {
  const remaining = Math.max(0, Math.min(100, 100 - w.used));
  const now = Date.now() / 1000;
  const parts = [];
  if (w.reset) {
    parts.push(tr("đã reset", "reset"));
  } else if (w.resets_at) {
    parts.push(tr(`còn ${left(w.resets_at - now)}`, `${left(w.resets_at - now)} left`));
  }
  if (!showAll && five) {
    const fiveRem = Math.round(Math.max(0, Math.min(100, 100 - five.used)));
    parts.push(`5h: ${fiveRem}%`);
  }
  return h_flex()
    .items_center()
    .gap(8)
    .min_h(lhPx(TEXT) + 4)
    .child(small(div().w(LABEL_W).flex_none().truncate(), M.yellow).child(rowLabel(key, w.id)))
    .child(bar("", remaining, BAR_W, { blink: true, h: 9 }))
    .child(div().w(50).flex_none().text_size(TEXT).line_height(LH(TEXT)).text_color(hpColor(remaining)).child(`${Math.round(remaining)}%`))
    .child(small(div().flex_1().min_w(0).truncate()).child(parts.join(" · ")));
}

export default class Role {
  init(props, cx) {
    this.showAll = false;
    this.pane = props?.pane ?? null;
    this.focus = cx.focus_handle();
    cx.timer.after(0, () => this.focus.focus());
    cx.timer.every(30000, (cx) => cx.notify());
  }

  close() {
    const o = props()?.overlay;
    if (o) {
      closeOverlay(o);
      return;
    }
    const roles = { ...(shared("pocket.pane.roles") ?? {}) };
    const pane = this.pane ?? props()?.pane ?? panes().find((p) => roles[p.pane] === "stamina")?.pane ?? shared("pocket.stamina.pane");
    if (pane) {
      delete roles[pane];
      setShared("pocket.pane.roles", roles);
      if (shared("pocket.stamina.pane") === pane) setShared("pocket.stamina.pane", null);
      run("pane.close", { pane });
    }
  }

  render(_cx) {
    const hp = shared("pocket.hp") ?? {};
    const stats = shared("machines.stats") ?? {};
    const machines = [...new Set(["", ...Object.keys(hp), ...Object.keys(stats)])];

    const groups = [];
    let latestAt = 0;

    for (const m of machines) {
      for (const prod of PRODUCTS) {
        const lims = limitsForProduct(prod.key, m);
        if (!lims.length) continue;
        const weekly = lims.filter((w) => w.id.startsWith("7d") || w.id.startsWith("month"));
        const shown = this.showAll ? lims : (weekly.length ? weekly : lims);
        const acct = productAccountOf(prod.key, m);
        const readAt = Number(hp?.[m]?.[prod.key]?.at) || 0;
        if (readAt > latestAt) latestAt = readAt;
        groups.push({
          machine: m,
          key: prod.key,
          name: prod.name,
          plan: acct?.plan ?? null,
          account: acct?.account ?? null,
          lims,
          shown,
        });
      }
    }

    const top = h_flex()
      .items_center()
      .gap(8)
      .child(
        div().flex_1().min_w(0).truncate()
          .text_size(BIG).font_family(FONT_BIG).line_height(LH(BIG)).text_color(M.yellow)
          .child(this.showAll ? tr("THỂ LỰC · TẤT CẢ CHU KỲ", "STAMINA · ALL WINDOWS") : tr("THỂ LỰC TUẦN · MỌI MODEL", "WEEKLY STAMINA · ALL MODELS")),
      )
      .child(
        button(
          "st-toggle",
          this.showAll ? tr("CHỈ TUẦN (7 NGÀY)", "WEEKLY ONLY (7D)") : tr("XEM CẢ 5 GIỜ", "SHOW 5H TOO"),
          (cx) => {
            this.showAll = !this.showAll;
            cx.notify();
          },
        ),
      );

    const sections = groups.map((g) => {
      const mLabel = g.machine ? tr(`MÁY ${g.machine.toUpperCase()}`, `MACHINE ${g.machine.toUpperCase()}`) : null;
      const meta = [g.plan ? g.plan.toUpperCase() : null, g.account, mLabel].filter(Boolean).join(" · ");
      const head = h_flex()
        .items_center()
        .gap(6)
        .child(sprite({ key: g.key }, 18))
        .child(div().text_size(TEXT).line_height(LH(TEXT)).text_color(M.lavender).child(g.name))
        .when(Boolean(meta), (e) => e.child(small(div().flex_1().min_w(0).truncate(), DARK).child(`· ${meta}`)));
      const subtleLine = () => div().h(1).bg(M.surface1).opacity(0.6).my(2);
      const rows = [];
      g.shown.forEach((w, i) => {
        if (i > 0) {
          const prev = g.shown[i - 1];
          const isFiveNow = w.id.startsWith("5h");
          const wasFive = prev.id.startsWith("5h");
          if (isFiveNow !== wasFive || (g.key === "antigravity" && w.id.split(":")[1] !== prev.id.split(":")[1])) {
            rows.push(subtleLine());
          }
        }
        rows.push(staminaRow(g.key, w, fiveMatchFor(g.lims, w.id), this.showAll));
      });
      return v_flex()
        .gap(2)
        .py(4)
        .border_b(1)
        .border_color(M.surface1)
        .child(head)
        .children(rows);
    });

    const content = sections.length
      ? v_flex().flex_1().min_h(0).overflow_y_scrollbar().gap(4).pr(4).children(sections)
      : v_flex().flex_1().justify_center().items_center().child(
          small(div()).child(tr("Chưa có số liệu giới hạn tuần cho các model.", "No weekly usage data found for models yet.")),
        );

    const footer = h_flex()
      .items_center()
      .gap(8)
      .child(
        small(div().flex_1().min_w(0).truncate(), M.overlay1).child(
          [
            tr("Phần trăm còn lại (100% − đã dùng)", "Remaining quota (100% − used)"),
            latestAt ? tr(`cập nhật: ${ago(latestAt)}`, `updated: ${ago(latestAt)}`) : null,
            tr("Esc để đóng", "Esc to close"),
          ].filter(Boolean).join(" · "),
        ),
      )
      .child(button("st-close", tr("ĐÓNG", "CLOSE"), () => this.close()));

    const divider = () => div().h(2).flex_none().bg(M.surface1);
    const body = v_flex()
      .size_full()
      .font_family(FONT)
      .gap(8)
      .child(top)
      .child(divider())
      .child(content)
      .child(footer);

    return frame(body, { id: "stamina", full: true, pad: 10 })
      .track_focus(this.focus)
      .on_key_down((e, cx) => {
        if (e.key === "escape") {
          this.close();
          cx.stop_propagation();
        }
      });
  }
}
