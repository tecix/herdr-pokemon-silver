// Pocket role "picker": the dialog overlay that chooses the Pokémon for a pane
// (opened by kit openPicker(pane) with props { role: "picker", pane, overlay }).
// Search by name or number, click or Enter to pick. Picking saves the dex for
// the pane and closes the overlay; the dialog role fetches the big art.
import { div, image } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { props, closeOverlay } from "herdr";
import { M, INK, DARK, PAPER, SELECT, FOCUS, FONT, TEXT, SMALL, BIG, monNameOf, pokeball, FONT_SMALL, LH, lhPx, FONT_BIG, crisp } from "./kit.js";
import { COUNT, monOf, monName, setMon, ensureIcons, iconPath } from "./mons.js";

// Numbers ("25", "#025") match the dex number; anything else matches the name
// (case-insensitive substring). An empty search shows every Pokémon.
function matches(query) {
  const q = String(query ?? "").trim().toLowerCase();
  const all = Array.from({ length: COUNT }, (_, i) => i + 1);
  if (!q) return all;
  if (/^#?\d+$/.test(q)) {
    const n = Number(q.replace("#", ""));
    return all.filter((d) => d === n);
  }
  return all.filter((d) => monName(d).toLowerCase().includes(q));
}

export default class Role {
  init(_props, cx) {
    this.ready = false;
    this.error = null;
    this.filter = "";
    this.input = InputState.new({ placeholder: "Tìm theo tên hoặc số…" });
    this.input.on("change", (_e, cx) => {
      this.filter = this.input.value();
      cx.notify();
    });
    this.input.on("submit", () => {
      const shown = matches(this.input.value());
      if (shown.length) this.choose(shown[0]);
    });
    cx.timer.after(300, () => this.input.focus());
    cx.spawn(async (cx) => {
      try {
        await ensureIcons();
        this.ready = true;
      } catch (e) {
        this.error = String(e?.message ?? e);
      }
      cx.notify();
    });
  }

  // Saves the pick for the pane and closes the dialog. No pane: nothing happens.
  choose(dex) {
    const p = props() ?? {};
    if (!p.pane) return;
    setMon(p.pane, dex);
    if (p.overlay) closeOverlay(p.overlay);
  }

  render(cx) {
    const p = props() ?? {};
    const pane = p.pane;
    const current = pane ? monOf(pane) : null;
    const shown = matches(this.filter);
    // A cell: the 40x30 menu icon at a whole-pixel scale (~48 tall), then the
    // number and the name, one SMALL line each; its height adds them up.
    const iconH = crisp(30, 48);
    const iconW = (iconH * 4) / 3;
    const cellH = Math.ceil(iconH + 2 * lhPx(SMALL) + 2 * 2 + 4 + 8);
    const line = pane
      ? `cho ${monNameOf(pane)} · #${String(current).padStart(3, "0")}`
      : "chưa chọn agent nào";

    return v_flex()
      .size_full()
      .bg(PAPER)
      .text_color(INK)
      .font_family(FONT)
      .text_size(TEXT)
      .p(12)
      .gap(8)
      .child(
        v_flex()
          .flex_none()
          .gap(2)
          .child(div().text_size(BIG).font_family(FONT_BIG).line_height(LH(BIG)).text_color(M.yellow).child("CHỌN POKÉMON"))
          .child(div().text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(DARK).truncate().child(line)),
      )
      .child(
        Input.new(this.input)
          .h(34)
          .flex_none()
          .px(8)
          .rounded(3)
          .border(2)
          .border_color(M.mauve)
          .bg(PAPER)
          .font_family(FONT)
          .text_size(TEXT)
          .text_color(INK),
      )
      .when(this.error, (el) =>
        el.child(
          div()
            .flex_none()
            .text_size(SMALL).font_family(FONT_SMALL)
            .line_height(LH(SMALL))
            .text_color(M.red)
            .child(`Không tải được biểu tượng (${this.error})`),
        ),
      )
      .child(
        div().flex_1().min_h(0).overflow_y_scrollbar().child(
          h_flex()
            .flex_wrap()
            .gap(6)
            .children(
              shown.map((dex) => {
                const picked = dex === current;
                return v_flex()
                  .id("pk-" + dex)
                  .w(96)
                  .h(cellH)
                  .py(4)
                  .flex_none()
                  .items_center()
                  .justify_center()
                  .gap(2)
                  .rounded(3)
                  .border(2)
                  .border_color(picked ? FOCUS : "#00000000")
                  .bg(picked ? SELECT : "#00000000")
                  .hover((s) => s.bg(M.surface0))
                  .cursor_pointer()
                  .on_click(() => this.choose(dex))
                  .child(
                    this.ready
                      ? image(iconPath(dex)).w(iconW).h(iconH).flex_none()
                      : div().w(iconW).h(iconH).flex_none().flex().items_center().justify_center().child(pokeball(24)),
                  )
                  .child(div().flex_none().text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(DARK).child("#" + String(dex).padStart(3, "0")))
                  .child(
                    div()
                      .flex_none()
                      .w_full()
                      .px(2)
                      .text_center()
                      .truncate()
                      .text_size(SMALL).font_family(FONT_SMALL)
                      .line_height(LH(SMALL))
                      .text_color(INK)
                      .child(monName(dex)),
                  );
              }),
            ),
        ),
      );
  }
}
