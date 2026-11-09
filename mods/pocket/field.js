// Pocket role "field": the bottom-left strip, the Pokémon walk. Each agent is its
// Pokémon: it walks while working, strolls while idle, sleeps after 3 minutes
// without a change, stops and calls for you when blocked, and shows ✓ when done.
// Ported from the strip part of mathieucroset/herdr-pokemon-agents (MIT).
import { div, image } from "gpui-kit";
import { run, settings } from "herdr";
import { monKey, walkOf } from "./mons.js";
import { frame, h_flex, FONT, SMALL, DARK, INK, M, STATUS_COLOR, agentName, moodOf, moodBubble, monNameOf, openPicker, pokeball, agentList, FONT_SMALL, LH } from "./kit.js";

const SLOT = 128; // one Pokémon's column (sprite + name tag)
const GROUND = 24; // the ground line, px above the strip's bottom (room for the name tag)
const TAG_TOP = 3; // name tag: px below the ground line
const TAG_H = 14;
const SPEED = { walk: 70, rest: 32 }; // px per second (working, idle)
const DEFAULT_W = 600;
const DEFAULT_H = 98;
// Rough width of one SMALL (Galmuri7) character, for tag collisions: half its size.
const charW = () => SMALL * 0.5;
const TAG_MAX = SLOT * 1.5; // a tag never gets wider than this (truncated)
const POKEBALL = 18;
const WALKS = ["walkR", "walkL", "idleR", "idleL", "sleep"];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const zoom = () => (Number(settings()?.zoom) > 0 ? Number(settings().zoom) : 1);

// Grass tufts at fixed, pseudo-random spots (seeded, so they never move).
function grass(n) {
  let s = 7;
  const next = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: n }, () => ({
    f: next(), // fraction of the strip's width
    w: 2 + Math.floor(next() * 2),
    h: 2 + Math.floor(next() * 2),
    c: next() < 0.5 ? M.green : M.teal,
  }));
}

export default class Role {
  init(_props, cx) {
    this.width = DEFAULT_W;
    this.height = DEFAULT_H;
    this.mons = {}; // address -> { x, from, target, dir, moving, start, dur, pauseUntil, mood }
    this.hover = null;
    this.tufts = grass(6);
    // The only timer: it wakes the view when a walk starts or ends, a mood
    // changes, or agents come and go. The walk itself runs natively.
    cx.timer.every(250, (cx) => this.tick(cx));
  }

  tick(cx) {
    const now = Date.now();
    const list = agentList();
    const lo = SLOT / 2;
    const hi = Math.max(lo, this.width - SLOT / 2);
    let changed = false;
    const live = new Set();
    list.forEach((a, i) => {
      live.add(a.address);
      let m = this.mons[a.address];
      if (!m) {
        const x = clamp(((i + 0.5) / list.length) * this.width + rand(-20, 20), lo, hi);
        m = this.mons[a.address] = { x, from: x, target: x, dir: Math.random() < 0.5 ? "l" : "r", moving: false, start: 0, dur: 0, pauseUntil: now + rand(300, 2500), mood: null };
        changed = true;
      }
      const mood = moodOf(a);
      if (mood !== m.mood) { m.mood = mood; m.tidy = false; changed = true; }
      const roams = mood === "walk" || mood === "rest";

      if (m.moving) {
        const f = clamp((now - m.start) / m.dur, 0, 1);
        if (m.target < lo || m.target > hi) {
          // The strip got narrower mid-walk: stop inside it instead of walking off the edge.
          m.x = m.target = clamp(m.from + (m.target - m.from) * f, lo, hi);
          m.moving = false;
          m.dur = 150;
          m.pauseUntil = now + rand(1000, 3000);
          changed = true;
        } else if (f >= 1) {
          m.moving = false;
          m.tidying = false;
          m.x = m.target;
          m.pauseUntil = now + (mood === "walk" ? rand(300, 1800) : rand(4000, 12000));
          changed = true;
        } else if (!roams && !m.tidying) {
          // Stop where it is: something needs the person, or it fell asleep.
          m.x = m.target = m.from + (m.target - m.from) * f;
          m.moving = false;
          m.dur = 150;
          changed = true;
        }
      } else if (roams && now >= m.pauseUntil && hi > lo) {
        const target = this.roomiest(a.address, m.x, lo, hi).x;
        if (Math.abs(target - m.x) >= 8) {
          m.from = m.x;
          m.target = target;
          m.dir = target > m.x ? "r" : "l";
          m.start = now;
          m.dur = (Math.abs(target - m.x) / SPEED[mood]) * 1000;
          m.moving = true;
          changed = true;
        } else {
          m.pauseUntil = now + rand(1000, 3000);
        }
      }
      if (mood === "sleep" && !m.moving && !m.tidy && hi > lo) {
        // Falling asleep on top of another one: walk to a free spot first, once.
        m.tidy = true;
        const near = this.roomiest(a.address, m.x, lo, hi, true);
        if (near.crowded) {
          const to = this.roomiest(a.address, m.x, lo, hi);
          if (to.room > near.room + 20 && Math.abs(to.x - m.x) >= 8) {
            Object.assign(m, { from: m.x, target: to.x, dir: to.x > m.x ? "r" : "l", start: now, dur: (Math.abs(to.x - m.x) / SPEED.rest) * 1000, moving: true, tidying: true });
            changed = true;
          }
        }
      }
      if (!m.moving && (m.x < lo || m.x > hi)) { m.x = m.target = clamp(m.x, lo, hi); m.dur = 150; changed = true; }
    });
    for (const k of Object.keys(this.mons)) if (!live.has(k)) { delete this.mons[k]; changed = true; }
    if (changed) cx.notify();
  }

  // Of a few random spots at least 60px away, the one farthest from the other
  // Pokémon (where they stand or are headed), so they spread out instead of
  // piling up: { x, room }. here = true: just how much room `x` has, and
  // whether it is crowded.
  roomiest(address, x, lo, hi, here = false) {
    const others = Object.entries(this.mons).filter(([k]) => k !== address).map(([, o]) => (o.moving ? o.target : o.x));
    const roomAt = (c) => Math.min(Infinity, ...others.map((o) => Math.abs(o - c)));
    if (here) {
      const room = roomAt(x);
      return { x, room, crowded: room < SLOT * 0.6 };
    }
    let best = { x, room: -1 };
    for (let t = 0; t < 8 && best.room < SLOT * 0.8; t++) {
      let c = rand(lo, hi);
      if (Math.abs(c - x) < 60) c = x + (c >= x ? 60 : -60);
      c = clamp(c, lo, hi);
      const room = roomAt(c);
      if (room > best.room) best = { x: c, room };
    }
    return best;
  }

  render(_cx) {
    const W = this.width;
    const H = this.height;
    const G = H - GROUND; // the ground line's top
    const now = Date.now();
    const list = agentList();

    let root = div()
      .id("field-root")
      .relative()
      .size_full()
      .overflow_hidden()
      .on_size_change((size, cx) => {
        // Reported in zoomed px; everything here is drawn in unzoomed units.
        const w = size.width / zoom();
        const h = size.height / zoom();
        if (Math.abs(w - this.width) > 1 || Math.abs(h - this.height) > 1) {
          this.width = w;
          this.height = h;
          cx.notify();
        }
      })
      .child(div().absolute().left(0).right(0).top(G).h(2).bg(M.surface1));
    for (const t of this.tufts) {
      root = root.child(div().absolute().left(t.f * W).top(G - t.h).w(t.w).h(t.h).bg(t.c));
    }

    if (list.length === 0) {
      root = root.child(
        div().absolute().left(0).top(0).w_full().h(G).flex().items_center().justify_center().px(8)
          .text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(DARK).text_center()
          .child("Chưa có Pokémon nào. Mỗi agent bạn mở sẽ xuất hiện ở đây."),
      );
      return frame(root, { full: true, pad: 0 });
    }

    const lo = SLOT / 2;
    const hi = Math.max(lo, W - SLOT / 2);
    // Where each one is drawn now (between two stops it's interpolated).
    const pos = (a) => {
      const m = this.mons[a.address];
      if (!m) return W / 2;
      if (!m.moving) return m.x;
      return m.from + (m.target - m.from) * clamp((now - m.start) / m.dur, 0, 1);
    };
    const label = (a, hovered) => (hovered ? `${agentName(a)} · ${monNameOf(a.pane)}` : agentName(a));

    // Name tags never overlap: the ones that matter most win (hovered > blocked > done > focused > rest).
    const rank = (a) => (this.hover === a.address ? 0 : a.status === "blocked" ? 1 : a.status === "done" ? 2 : a.focused ? 3 : 4);
    const placed = [];
    const showTag = new Set();
    for (const a of [...list].sort((x, y) => rank(x) - rank(y))) {
      const x0 = pos(a);
      const half = Math.min(TAG_MAX, label(a, this.hover === a.address).length * charW() + 14) / 2;
      if (placed.every(([l, r]) => x0 + half + 6 < l || x0 - half - 6 > r)) {
        placed.push([x0 - half, x0 + half]);
        showTag.add(a.address);
      }
    }

    // Left to right, so a Pokémon on the right overlaps one on the left, not the other way round.
    for (const a of [...list].sort((x, y) => pos(x) - pos(y))) {
      const m = this.mons[a.address] ?? { x: W / 2, target: W / 2, dir: "r", moving: false, dur: 0, mood: null };
      const mood = m.mood ?? moodOf(a);
      const hovered = this.hover === a.address;
      const x = m.moving ? m.target : m.x;
      const meta = walkOf(monKey(a.pane));

      let col = div()
        .id(`field-${a.address}`)
        .absolute()
        .top(0)
        .h_full()
        .w(SLOT)
        .left(x - SLOT / 2)
        .transition("left", { duration: Math.max(1, Math.round(m.moving ? m.dur : m.dur || 150)), easing: "linear" })
        .cursor_pointer()
        .on_hover((h, cx) => {
          const next = h ? a.address : this.hover === a.address ? null : this.hover;
          if (next !== this.hover) { this.hover = next; cx.notify(); }
        })
        .on_click(() => (a.pane ? run("pane.focus", { pane: a.pane }) : run("agent.focus", { terminal: a.address })))
        .on_mouse_down("right", (_e, cx) => {
          cx.stop_propagation();
          openPicker(a.pane);
        });

      let headY = G - POKEBALL;
      if (meta) {
        // One scale for all its animations, so it doesn't jump between them. Big ones shrink to fit above the ground.
        const tallest = Math.max(...WALKS.map((k) => meta[k].box.h));
        const k = Math.min(1, (G - 22) / tallest);
        const s = mood === "sleep" && !m.moving ? meta.sleep
          : m.moving ? (m.dir === "r" ? meta.walkR : meta.walkL)
          : (m.dir === "r" ? meta.idleR : meta.idleL);
        const bx = s.box.x * k;
        const by = s.box.y * k;
        const bw = s.box.w * k;
        const bh = s.box.h * k;
        headY = G - bh;
        // Visible feet on the ground line, visible body centered in the column.
        const shadowW = Math.max(14, Math.round(bw * 0.7));
        col = col
          .child(div().absolute().left(SLOT / 2 - shadowW / 2).top(G - 4).w(shadowW).h(6).rounded_full().bg(M.crust).opacity(0.35))
          .child(image(s.path).absolute().left(SLOT / 2 - (bx + bw / 2)).top(G - (by + bh)).w(s.w * k).h(s.h * k));
      } else {
        // Art still downloading: a Poké Ball waits in its place.
        col = col
          .child(div().absolute().left(SLOT / 2 - 10).top(G - 4).w(20).h(6).rounded_full().bg(M.crust).opacity(0.35))
          .child(div().absolute().left(SLOT / 2 - POKEBALL / 2).top(G - POKEBALL).child(pokeball(POKEBALL)));
      }

      const bubble = moodBubble(mood, SMALL);
      if (bubble) {
        col = col.child(h_flex().absolute().left(0).w(SLOT).top(Math.max(0, headY - 20)).justify_center().child(bubble));
      }

      if (showTag.has(a.address)) {
        const bright = hovered || a.focused;
        col = col.child(
          h_flex()
            .absolute()
            .left(0)
            .w(SLOT)
            .top(G + TAG_TOP)
            .h(TAG_H)
            .justify_center()
            .items_center()
            .gap(4)
            .child(div().flex_none().size(6).rounded_full().bg(STATUS_COLOR[a.status] ?? M.overlay1))
            .child(
              div()
                .flex_none()
                .max_w(TAG_MAX - 14)
                .truncate()
                .text_size(SMALL).font_family(FONT_SMALL)
                .line_height(LH(SMALL))
                .font_family(FONT)
                .text_color(bright ? INK : DARK)
                .child(label(a, hovered)),
            ),
        );
      }
      root = root.child(col);
    }

    return frame(root, { full: true, pad: 0 });
  }
}
