// Pocket role "bag": a Gen 2 bag of items; using an item sends a preset
// command to that one agent's terminal.
import { div } from "gpui-kit";
import { InputState, Input } from "gpui-base";
import { props, closeOverlay, hc, shared, setShared } from "herdr";
import {
  frame, h_flex, v_flex, cursor, M, INK, DARK, PAPER, SELECT, FOCUS,
  FONT, FONT_SMALL, FONT_BIG, TEXT, SMALL, BIG, LH,
  agentList, agentName, pushEvent, tr,
} from "./kit.js";

function builtins() {
  return [
    {
      name: "POTION",
      desc: () => tr("Nén ngữ cảnh (/compact)", "Compact the context (/compact)"),
      builtin: true,
      action: (addr) => hc(["send", addr, "/compact"]),
    },
    {
      name: "ESCAPE ROPE",
      desc: () => tr("Dừng lượt đang chạy", "Stop the current turn"),
      builtin: true,
      action: (addr) => hc(["interrupt", addr]),
    },
    {
      name: "RARE CANDY",
      desc: () => tr("Bảo agent làm tiếp", "Tell it to continue"),
      builtin: true,
      action: (addr) => hc(["send", addr, "continue"]),
    },
    {
      name: "TM01 TEST",
      desc: () => tr("Chạy test và sửa lỗi", "Run the tests and fix failures"),
      builtin: true,
      action: (addr) => hc(["send", addr, "Run the project's tests and fix any failures."]),
    },
    {
      name: "TM02 REVIEW",
      desc: () => tr("Tự soát lỗi trước khi xong", "Review its changes for bugs"),
      builtin: true,
      action: (addr) => hc(["send", addr, "Review your changes so far for bugs before you finish."]),
    },
    {
      name: "POKÉ FLUTE",
      desc: () => tr("Tóm tắt việc đã làm", "Summarize progress"),
      builtin: true,
      action: (addr) => hc(["send", addr, "Summarize what you did and what is left, in 5 lines."]),
    },
    {
      name: "FULL RESTORE",
      desc: () => tr("Xóa ngữ cảnh (/clear)", "Clear the context (/clear)"),
      builtin: true,
      action: (addr) => hc(["send", addr, "/clear"]),
    },
  ];
}

function nextTmName() {
  let max = 2; // TM01 and TM02 are built-in
  const raw = shared("pocket.bag");
  if (Array.isArray(raw)) {
    for (const it of raw) {
      const m = String(it?.name ?? "").match(/^TM(\d+)/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (!isNaN(n) && n > max) max = n;
      }
    }
  }
  return `TM${String(max + 1).padStart(2, "0")}`;
}

export default class Role {
  init(_props, cx) {
    this.at = 0;
    this.confirm = null;
    this.confirmChoice = 0;
    this.error = null;
    this.busy = false;

    this.focus = cx.focus_handle();
    cx.timer.after(0, () => this.focus.focus());

    this.input = InputState.new({
      placeholder: tr("Thêm: TÊN: lệnh", "Add: NAME: command"),
    });
    this.input.on("submit", (_e, cx) => {
      this.addCustom(cx);
    });
    // Keys typed into the add box bubble up to key(): ignore them there (but Esc).
    this.typing = false;
    this.input.on("focus", () => { this.typing = true; });
    this.input.on("blur", () => { this.typing = false; });
  }

  items() {
    const raw = shared("pocket.bag");
    const customList = Array.isArray(raw) ? raw : [];
    const customs = customList.map((c, i) => ({
      name: c.name || `TM${String(i + 3).padStart(2, "0")}`,
      text: c.text || "",
      builtin: false,
      customIndex: i,
      desc: () => c.text || "",
      action: (addr) => hc(["send", addr, c.text]),
    }));
    return [...builtins(), ...customs];
  }

  addCustom(cx) {
    const raw = String(this.input?.value() ?? "").trim();
    if (!raw) return;

    let name = "";
    let text = "";
    const colonIdx = raw.indexOf(":");
    if (colonIdx >= 0) {
      name = raw.slice(0, colonIdx).trim().toUpperCase();
      text = raw.slice(colonIdx + 1).trim();
    } else {
      name = nextTmName();
      text = raw;
    }
    if (!name) name = nextTmName();
    if (!text) return;

    const current = shared("pocket.bag");
    const list = Array.isArray(current) ? [...current] : [];
    list.push({ name, text });
    setShared("pocket.bag", list);

    this.input.set_value("");
    this.focus.focus();
    cx?.notify?.();
  }

  close() {
    const p = props() ?? {};
    if (p.overlay) closeOverlay(p.overlay);
  }

  startUse(item, agent, cx) {
    if (this.busy) return;
    this.error = null;
    this.confirm = { kind: "use", item, agent };
    this.confirmChoice = 0;
    cx?.notify?.();
  }

  startRemove(item, cx) {
    if (this.busy || item.builtin) return;
    this.error = null;
    this.confirm = { kind: "remove", item, index: item.customIndex };
    this.confirmChoice = 0;
    cx?.notify?.();
  }

  confirmAction(cx) {
    if (this.busy || !this.confirm) return;
    const cf = this.confirm;

    if (cf.kind === "remove") {
      const current = shared("pocket.bag");
      const list = Array.isArray(current) ? [...current] : [];
      if (cf.index >= 0 && cf.index < list.length) {
        list.splice(cf.index, 1);
        setShared("pocket.bag", list);
      }
      this.confirm = null;
      const all = this.items();
      if (this.at >= all.length) {
        this.at = Math.max(0, all.length - 1);
      }
      cx?.notify?.();
      return;
    }

    if (cf.kind === "use") {
      const item = cf.item;
      const a = cf.agent;
      const addr = a?.address;
      if (!addr) {
        this.confirm = null;
        this.error = tr("Không tìm thấy địa chỉ agent", "Agent address not found");
        cx?.notify?.();
        return;
      }

      this.busy = true;
      cx?.notify?.();
      cx.spawn(async (cx) => {
        try {
          const res = await item.action(addr);
          if (res && typeof res.code === "number" && res.code !== 0) {
            this.error = (res.stderr || res.stdout || `Error code ${res.code}`).trim();
            this.confirm = null;
            this.busy = false;
            cx.notify();
            return;
          }
          const name = agentName(a);
          pushEvent(tr(`${name} dùng ${item.name}!`, `${name} used ${item.name}!`), addr, "info");
          this.close();
        } catch (err) {
          this.error = String(err?.message ?? err).trim();
          this.confirm = null;
          this.busy = false;
          cx.notify();
        }
      });
    }
  }

  key(e, cx) {
    const k = e.key;

    if (this.typing && k !== "escape") return;
    if (k === "escape") {
      cx.stop_propagation();
      if (this.typing) {
        this.focus.focus();
        return;
      }
      if (this.confirm) {
        this.confirm = null;
        cx.notify();
      } else {
        this.close();
      }
      return;
    }

    if (this.confirm) {
      if (k === "y" || k === "Y") {
        cx.stop_propagation();
        this.confirmChoice = 0;
        this.confirmAction(cx);
        return;
      }
      if (k === "n" || k === "N") {
        cx.stop_propagation();
        this.confirmChoice = 1;
        this.confirm = null;
        cx.notify();
        return;
      }
      if (k === "left" || k === "right" || k === "up" || k === "down" || k === "h" || k === "l" || k === "j" || k === "k" || k === "tab") {
        cx.stop_propagation();
        this.confirmChoice = this.confirmChoice === 0 ? 1 : 0;
        cx.notify();
        return;
      }
      if (k === "enter" || k === "space") {
        cx.stop_propagation();
        if (this.confirmChoice === 0) {
          this.confirmAction(cx);
        } else {
          this.confirm = null;
          cx.notify();
        }
        return;
      }
      return;
    }

    const list = this.items();
    if (!list.length) return;

    if (k === "down" || k === "j") {
      this.at = (this.at + 1) % list.length;
      this.error = null;
    } else if (k === "up" || k === "k") {
      this.at = (this.at + list.length - 1) % list.length;
      this.error = null;
    } else if (k === "enter" || k === "space") {
      const it = list[this.at];
      const p = props() ?? {};
      const all = agentList();
      const a = (p.address ? all.find((x) => x.address === p.address) : null) ?? all[0];
      if (it && a) {
        cx.stop_propagation();
        this.startUse(it, a, cx);
      }
      return;
    } else {
      return;
    }
    cx.stop_propagation();
    cx.notify();
  }

  render(cx) {
    const p = props() ?? {};
    const all = agentList();
    const a = (p.address ? all.find((x) => x.address === p.address) : null) ?? all[0];

    if (!a) {
      const content = v_flex()
        .size_full()
        .items_center()
        .justify_center()
        .gap(8)
        .child(
          div()
            .text_size(TEXT)
            .font_family(FONT)
            .line_height(LH(TEXT))
            .text_color(DARK)
            .child(tr("Không có agent", "No agent")),
        )
        .child(
          div()
            .text_size(SMALL)
            .font_family(FONT_SMALL)
            .line_height(LH(SMALL))
            .text_color(M.overlay0)
            .child(tr("Nhấn Esc để đóng", "Press Esc to close")),
        );
      return frame(content, { id: "bag", full: true, pad: 12 })
        .track_focus(this.focus)
        .on_key_down((e, cx) => {
          if (e.key === "escape") {
            this.close();
            cx.stop_propagation();
          }
        });
    }

    const list = this.items();
    if (this.at >= list.length) {
      this.at = Math.max(0, list.length - 1);
    }

    const titleRow = h_flex()
      .flex_none()
      .items_baseline()
      .justify_between()
      .child(
        div()
          .text_size(BIG)
          .font_family(FONT_BIG)
          .line_height(LH(BIG))
          .text_color(M.yellow)
          .child(tr("TÚI ĐỒ", "BAG")),
      )
      .child(
        h_flex()
          .gap(8)
          .items_baseline()
          .child(
            div()
              .text_size(TEXT)
              .font_family(FONT)
              .line_height(LH(TEXT))
              .text_color(DARK)
              .truncate()
              .child(agentName(a)),
          )
          .child(
            div()
              .id("bag-close")
              .px(4)
              .text_size(SMALL)
              .font_family(FONT_SMALL)
              .text_color(DARK)
              .cursor_pointer()
              .hover((s) => s.text_color(INK))
              .on_click((_e, cx) => {
                cx.stop_propagation();
                this.close();
              })
              .child("✕"),
          ),
      );

    const rows = list.map((item, i) => {
      const isSel = this.at === i;
      return h_flex()
        .id("bag-item-" + i)
        .h(Math.round(TEXT * 1.6))
        .items_center()
        .justify_between()
        .px(4)
        .rounded(3)
        .bg(isSel ? SELECT : PAPER)
        .cursor_pointer()
        .on_hover((h, cx) => {
          if (h && this.at !== i && !this.confirm) {
            this.at = i;
            this.error = null;
            cx.notify();
          }
        })
        .on_click((_e, cx) => {
          cx.stop_propagation();
          this.focus.focus();
          this.at = i;
          this.startUse(item, a, cx);
        })
        .on_mouse_down("right", (_e, cx) => {
          cx.stop_propagation();
          this.focus.focus();
          if (!item.builtin) {
            this.at = i;
            this.startRemove(item, cx);
          }
        })
        .child(
          h_flex()
            .items_center()
            .gap(4)
            .child(cursor(isSel))
            .child(
              div()
                .text_size(TEXT)
                .font_family(FONT)
                .line_height(LH(TEXT))
                .text_color(isSel ? INK : DARK)
                .child(item.name),
            ),
        )
        .child(
          item.builtin
            ? div()
                .text_size(TEXT)
                .font_family(FONT)
                .line_height(LH(TEXT))
                .text_color(DARK)
                .child("×∞")
            : div(),
        );
    });

    const itemList = div()
      .id("bag-scroll")
      .flex_1()
      .min_h(0)
      .overflow_y_scrollbar()
      .pr(4)
      .child(v_flex().gap(2).children(rows));

    const inputRow = Input.new(this.input)
      .h(32)
      .flex_none()
      .px(8)
      .rounded(3)
      .border(2)
      .border_color(M.mauve)
      .bg(PAPER)
      .font_family(FONT)
      .text_size(TEXT)
      .text_color(INK);

    let bottomContent;
    if (this.confirm) {
      const qText = this.confirm.kind === "remove"
        ? tr(`Xóa ${this.confirm.item.name}?`, `Remove ${this.confirm.item.name}?`)
        : tr(`Dùng ${this.confirm.item.name} cho ${agentName(a)}?`, `Use ${this.confirm.item.name} on ${agentName(a)}?`);

      const yesBtn = h_flex()
        .id("bag-yes")
        .gap(4)
        .items_center()
        .cursor_pointer()
        .on_hover((h, cx) => {
          if (h && this.confirmChoice !== 0) {
            this.confirmChoice = 0;
            cx.notify();
          }
        })
        .on_click((_e, cx) => {
          cx.stop_propagation();
          this.confirmChoice = 0;
          this.confirmAction(cx);
        })
        .child(cursor(this.confirmChoice === 0))
        .child(
          div()
            .text_size(TEXT)
            .font_family(FONT)
            .line_height(LH(TEXT))
            .text_color(this.confirmChoice === 0 ? INK : DARK)
            .child(tr("CÓ", "YES")),
        );

      const noBtn = h_flex()
        .id("bag-no")
        .gap(4)
        .items_center()
        .cursor_pointer()
        .on_hover((h, cx) => {
          if (h && this.confirmChoice !== 1) {
            this.confirmChoice = 1;
            cx.notify();
          }
        })
        .on_click((_e, cx) => {
          cx.stop_propagation();
          this.confirmChoice = 1;
          this.confirm = null;
          cx.notify();
        })
        .child(cursor(this.confirmChoice === 1))
        .child(
          div()
            .text_size(TEXT)
            .font_family(FONT)
            .line_height(LH(TEXT))
            .text_color(this.confirmChoice === 1 ? INK : DARK)
            .child(tr("KHÔNG", "NO")),
        );

      bottomContent = v_flex()
        .size_full()
        .justify_between()
        .child(
          div()
            .truncate()
            .text_size(TEXT)
            .font_family(FONT)
            .line_height(LH(TEXT))
            .text_color(INK)
            .child(qText),
        )
        .child(
          h_flex()
            .gap(16)
            .justify_end()
            .items_center()
            .child(yesBtn)
            .child(noBtn),
        );
    } else if (this.error) {
      bottomContent = v_flex()
        .size_full()
        .justify_center()
        .child(
          div()
            .text_size(SMALL)
            .font_family(FONT_SMALL)
            .line_height(LH(SMALL))
            .text_color(M.red)
            .child(this.error),
        );
    } else {
      const cur = list[this.at];
      const descText = cur ? (typeof cur.desc === "function" ? cur.desc() : cur.desc) : "";
      bottomContent = v_flex()
        .size_full()
        .justify_center()
        .child(
          div()
            .text_size(TEXT)
            .font_family(FONT)
            .line_height(LH(TEXT))
            .text_color(DARK)
            .child(descText || " "),
        );
    }

    const bottomBox = frame(bottomContent, { id: "bag-desc", pad: 8 })
      .h(68)
      .flex_none();

    const body = v_flex()
      .size_full()
      .gap(8)
      .child(titleRow)
      .child(itemList)
      .child(inputRow)
      .child(bottomBox);

    return frame(body, { id: "bag", full: true, pad: 12 })
      .track_focus(this.focus)
      .on_key_down((e, cx) => this.key(e, cx));
  }
}
