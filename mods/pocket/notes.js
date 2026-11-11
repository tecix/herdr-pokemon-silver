// Notes / GHI CHÚ: the header of the layout column "notes" (right of the panes,
// hidden until opened). Below it a terminal block shows Neovim on
// data/pocket/notes.md (the core terminal named "pocket-notes", kit ensureNotes).
// Alt+N or the top bar's NOTES button opens it and puts the keyboard in Neovim;
// Alt+N again from Neovim hides it and goes back to the pane you came from.
// Neovim keeps running while hidden, and saves the file on every change.

import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { M, INK, DARK, FONT, TEXT, SMALL, FONT_SMALL, LH, notesShown, notesReady, notesTerminal, notesFocused, ensureNotes, closeNotes, tr } from "./kit.js";

export default class Role {
  init(_props, cx) {
    // Shown with no Neovim (after a reboot, or :q): start it and its block again.
    const check = (cx) => {
      if (notesShown() && !notesReady()) cx.spawn(async (cx) => { await ensureNotes(); cx.notify(); });
    };
    cx.timer.every(3000, check);
    check(cx);
  }

  render(_cx) {
    const live = Boolean(notesTerminal());
    const on = notesFocused();
    const small = (el) => el.text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(DARK);
    return h_flex()
      .id("notes-head")
      .size_full()
      .px(8)
      .gap(8)
      .items_center()
      .bg(on ? M.surface0 : M.mantle)
      .border_b(1)
      .border_color(M.surface2)
      .font_family(FONT)
      .text_size(TEXT)
      .line_height(LH(TEXT))
      .child(div().flex_none().text_color(M.yellow).child(tr("GHI CHÚ", "NOTES")))
      .child(small(div().flex_1().min_w(0).truncate()).child(live ? "nvim · notes.md" : tr("đang mở nvim…", "starting nvim…")))
      .child(small(div().flex_none()).child("ALT+N"))
      .child(
        div()
          .id("notes-close")
          .flex_none()
          .h(20)
          .px(6)
          .flex()
          .items_center()
          .rounded(3)
          .border(1)
          .border_color(M.surface2)
          .text_color(DARK)
          .cursor_pointer()
          .hover((s) => s.bg(M.surface1).text_color(INK).border_color(M.red))
          .on_click(() => closeNotes())
          .child("X"),
      );
  }
}
