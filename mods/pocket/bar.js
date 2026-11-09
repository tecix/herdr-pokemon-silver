// Pocket role "bar": the top strip, 34px tall. It spans the window and drags it
// (the layout sets window_drag); every clickable box stops the mouse-down so a
// press on it doesn't start a drag. Place name, the active space's tabs, badges,
// clock, the THƯ button (notifications, kit openInbox; a red count when some
// are unread), the MENU button (kit openMenu: settings are in there), and
// window buttons when the system draws none.
//
// Look: Catppuccin Macchiato, Gen 2 flavored. Tabs are small pills; a tab's
// status is a 6px dot (blocked blinks). Badges are gym badges, earned ones in
// rotating colors.
import { div } from "gpui-kit";
import { run, spaces, shared, window as windowInfo } from "herdr";
import { M, INK, DARK, FONT, TEXT, SMALL, STATUS_COLOR, placeName, h_flex, glyph, FONT_SMALL, LH, BADGE_SLOTS, BADGE_COLORS, badgeCount, openMenu, openInbox, unreadCount } from "./kit.js";

const DAYS = ["CN", "THỨ 2", "THỨ 3", "THỨ 4", "THỨ 5", "THỨ 6", "THỨ 7"];

// Gen 2 clock: "THỨ 2 20:08", the day in upper case, then HH:MM.
function clockText() {
  const d = new Date();
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${DAYS[d.getDay()]} ${hm}`;
}

// A tab's status dot, 6px in its status color. Blocked blinks.
function statusDot(status) {
  const color = STATUS_COLOR[status];
  if (!color) return null;
  let dot = div().size(6).flex_none().rounded(3).bg(color);
  if (status === "blocked") dot = dot.loop("opacity", { from: 0.35, to: 1, period: 900 });
  return dot;
}

// A tab pill: active = surface1 fill with a mauve border (the one its space shows).
function tabBox(t) {
  let box = h_flex()
    .id(`bar-tab-${t.id}`)
    .flex_none()
    .h(22)
    .gap(5)
    .px(7)
    .items_center()
    .rounded(3)
    .border(1)
    .border_color(t.active ? M.mauve : M.surface2)
    .bg(t.active ? M.surface1 : M.crust)
    .text_color(INK)
    .cursor_pointer()
    .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
    .on_click(() => run("tab.select", { id: t.id }));
  if (!t.active) box = box.hover((s) => s.bg(M.surface0));
  const dot = statusDot(t.status);
  if (dot) box = box.child(dot);
  return box.child(div().max_w(160).truncate().child(t.name));
}

// A window button: rounded, hover fills with `hover.bg` and inks `hover.fg`.
function windowButton(id, label, command, hover = { bg: M.surface1, fg: INK }) {
  return div()
    .id(id)
    .w(22)
    .h(22)
    .flex_none()
    .rounded(3)
    .flex()
    .items_center()
    .justify_center()
    .text_center()
    .cursor_pointer()
    .text_color(DARK)
    .hover((s) => s.bg(hover.bg).text_color(hover.fg))
    .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
    .on_click(() => run(command))
    .child(label);
}

export default class Role {
  init(_props, cx) {
    cx.timer.every(15000, (cx) => cx.notify());
  }

  render(_cx) {
    const win = windowInfo() ?? {};
    const mac = win.platform === "macos";
    const active = spaces().find((s) => s.active);
    const tabs = (active?.tabs ?? []).filter((t) => !t.settled);
    const earned = badgeCount();
    const unread = unreadCount();

    let badges = h_flex().gap(3).flex_none().items_center().child(
      div().text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(DARK).child("HUY HIỆU"),
    );
    for (let i = 0; i < BADGE_SLOTS; i++) {
      badges = badges.child(
        div()
          .flex_none()
          .text_color(i < earned ? BADGE_COLORS[i] : M.surface2)
          .child(glyph(i < earned ? "badge" : "badge-empty", 10)),
      );
    }

    let root = h_flex()
      .size_full()
      .bg(M.crust)
      .text_color(INK)
      .font_family(FONT)
      .text_size(TEXT)
      .items_center()
      .px(12)
      .gap(10)
      .border_b(1)
      .border_color(M.surface0);
    if (mac) root = root.pl(80);

    root = root
      .child(
        h_flex()
          .flex_none()
          .gap(6)
          .items_center()
          .child(div().flex_none().text_color(M.mauve).child(glyph("badge", 10)))
          .child(div().max_w(240).truncate().text_color(M.lavender).child(placeName())),
      )
      .child(
        h_flex()
          .gap(6)
          .items_center()
          .min_w(0)
          .overflow_hidden()
          .children(tabs.map(tabBox))
          .child(
            div()
              .id("bar-tab-new")
              .flex_none()
              .h(22)
              .px(7)
              .flex()
              .items_center()
              .rounded(3)
              .border(1)
              .border_color(M.surface2)
              .text_color(DARK)
              .cursor_pointer()
              .hover((s) => s.bg(M.surface1).text_color(INK))
              .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
              .on_click(() => run("tab.new", {}))
              .child("+"),
          ),
      )
      .child(div().flex_1().min_w(0))
      .child(badges)
      .child(div().flex_none().text_color(M.peach).child(clockText()))
      // Notifications: THƯ, with the unread count.
      .child(
        h_flex()
          .id("bar-inbox")
          .flex_none()
          .h(22)
          .px(8)
          .gap(5)
          .items_center()
          .rounded(3)
          .border(1)
          .border_color(M.surface2)
          .text_color(unread ? INK : DARK)
          .cursor_pointer()
          .hover((s) => s.bg(M.surface1).border_color(M.mauve))
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .on_click(() => openInbox())
          .child("THƯ")
          .when(unread > 0, (e) => e.child(
            div().flex_none().px(4).rounded(7).bg(M.red).text_color(M.crust)
              .text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL))
              .child(unread > 99 ? "99+" : String(unread)),
          )),
      )
      // The START menu: trainer card, town map, Pokémon, settings.
      .child(
        div()
          .id("bar-menu")
          .flex_none()
          .h(22)
          .px(8)
          .flex()
          .items_center()
          .rounded(3)
          .border(1)
          .border_color(M.surface2)
          .text_color(M.yellow)
          .cursor_pointer()
          .hover((s) => s.bg(M.surface1).border_color(M.yellow))
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .on_click(() => openMenu())
          .child("MENU"),
      );

    if (win.buttons) {
      root = root.child(
        h_flex()
          .gap(4)
          .flex_none()
          .children([
            windowButton("bar-win-min", "_", "window.minimize"),
            windowButton("bar-win-max", glyph("zoom", 10), "window.maximize"),
            windowButton("bar-win-close", "X", "window.close", { bg: M.red, fg: M.crust }),
          ]),
      );
    }
    return root;
  }
}
