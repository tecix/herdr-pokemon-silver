// Pocket role "field": the bottom-left strip, the Pokémon walk. Each agent is its
// Pokémon: it walks while working, strolls while idle, sleeps after 3 minutes
// without a change, stops and calls for you when blocked, and shows ✓ when done.
// Ported from the strip part of mathieucroset/herdr-pokemon-agents (MIT).
// Right-click a Pokémon: its moves (role "fight"); the one picked plays here
// (shared "pocket.fx", drawn by fx.js), the Pokémon stopping for it.
// Behind them, the shown town's backdrop (scene.js): one biome per town.
import { div, image } from "gpui-kit";
import { run, settings, shared, setShared } from "herdr";
import { monKey, walkOf } from "./mons.js";
import { frame, h_flex, FONT, SMALL, DARK, INK, M, STATUS_COLOR, agentName, moodOf, moodBubble, monNameOf, openFight, pokeballStill, agentList, FONT_SMALL, LH, tr } from "./kit.js";
import { lastCast } from "./moves.js";
import { effectOf, fxDuration, TYPE_COLOR } from "./fx.js";
import { activeTown, biomeOf, buildScene, scenery } from "./scene.js";

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

export default class Role {
  init(_props, cx) {
    this.width = DEFAULT_W;
    this.height = DEFAULT_H;
    this.mons = {}; // address -> { x, from, target, dir, moving, start, dur, pauseUntil, mood }
    this.hover = null;
    this.fieldHovered = false;
    this.pops = [];
    this.scene = null; // the backdrop of the shown town (scene.js), rebuilt when the town changes
    // The move being played: { address, name, type, tier, at, phase 0|1 }.
    // Casts from before this view started are not replayed.
    this.fx = null;
    this.fxSeen = lastCast()?.at ?? 0;
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

      const meta = walkOf(monKey(a.pane));
      if (!meta) {
        // Art still downloading: keep Poké Ball fixed in place, do not walk.
        m.wasBall = true;
        if (m.moving) {
          m.x = m.target = m.from;
          m.moving = false;
          m.dur = 0;
          changed = true;
        }
        return;
      }
      if (m.wasBall) {
        m.wasBall = false;
        const G = this.height - GROUND;
        this.spawnPop(cx, m.x, G - POKEBALL / 2);
        changed = true;
      }

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
    if (this.startCast(cx, now)) changed = true;
    if (this.townKey() !== this.scene?.key) changed = true; // another town: another backdrop
    if (changed) cx.notify();
  }

  // The shown town's biome + key; the scene is rebuilt when it changes.
  townKey() {
    const t = activeTown();
    return `${biomeOf(t)}|${t.key}`;
  }

  currentScene() {
    const key = this.townKey();
    if (this.scene?.key !== key) {
      const t = activeTown();
      this.scene = { key, ...buildScene(biomeOf(t), t.key) };
    }
    return this.scene;
  }

  // A new cast (moves.js castMove): stop that Pokémon where it is, draw the
  // particles at their start, then at their end one frame later (the
  // transitions move them), and clear it when it's over.
  startCast(cx, now) {
    const c = lastCast();
    if (!c || c.at <= this.fxSeen) return false;
    this.fxSeen = c.at;
    const m = this.mons[c.address];
    if (!m || now - c.at > 3000) return false;
    const dur = fxDuration(c.tier);
    if (m.moving) {
      const f = clamp((now - m.start) / m.dur, 0, 1);
      m.x = m.target = m.from + (m.target - m.from) * f;
      m.moving = false;
      m.dur = 150;
    }
    m.pauseUntil = Math.max(m.pauseUntil, now + dur + 600);
    this.fx = { ...c, phase: 0 };
    cx.timer.after(50, (cx) => {
      if (this.fx?.at === c.at) { this.fx.phase = 1; cx.notify(); }
    });
    cx.timer.after(dur + 300, (cx) => {
      if (this.fx?.at === c.at) { this.fx = null; cx.notify(); }
    });
    return true;
  }

  // A brief white circle grows and fades where a Poké Ball just opened into art.
  spawnPop(cx, x, y) {
    const id = Date.now() + Math.random();
    const pop = { id, x, y, phase: 0 };
    this.pops.push(pop);
    cx.timer.after(30, (cx) => {
      pop.phase = 1;
      cx.notify();
    });
    cx.timer.after(350, (cx) => {
      this.pops = this.pops.filter((p) => p.id !== id);
      cx.notify();
    });
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
    const plain = Boolean(shared("pocket.field.plain"));

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
      .on_hover((h, cx) => {
        if (this.fieldHovered !== h) {
          this.fieldHovered = h;
          cx.notify();
        }
      });

    if (!plain) {
      root = root.children(scenery(this.currentScene(), W, H, G));
    }

    const bgBtn = div()
      .id("field-btn-bg")
      .flex_none()
      .h(18)
      .px(5)
      .flex()
      .items_center()
      .justify_center()
      .rounded(3)
      .border(1)
      .border_color(!plain ? M.mauve : M.surface2)
      .when(!plain, (s) => s.bg(M.surface1))
      .text_color(!plain ? INK : DARK)
      .text_size(SMALL)
      .font_family(FONT_SMALL)
      .line_height(LH(SMALL))
      .cursor_pointer()
      .hover((s) => s.bg(M.surface1).border_color(M.mauve).text_color(INK))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click((_e, cx) => {
        setShared("pocket.field.plain", !plain);
        cx?.notify?.();
      })
      .child(tr("NỀN", "BG"));

    const hideBtn = div()
      .id("field-btn-hide")
      .flex_none()
      .h(18)
      .px(5)
      .flex()
      .items_center()
      .justify_center()
      .rounded(3)
      .border(1)
      .border_color(M.surface2)
      .text_color(DARK)
      .text_size(SMALL)
      .font_family(FONT_SMALL)
      .line_height(LH(SMALL))
      .cursor_pointer()
      .hover((s) => s.bg(M.surface1).border_color(M.sapphire).text_color(INK))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click(() => run("layout.hide", { id: "bottom" }))
      .child("▼");

    const optRow = h_flex()
      .id("field-options")
      .absolute()
      .top(4)
      .right(6)
      .gap(4)
      .items_center()
      .opacity(this.fieldHovered ? 1 : 0.45)
      .transition("opacity", { duration: 150 })
      .hover((s) => s.opacity(1))
      .child(bgBtn)
      .child(hideBtn);

    if (list.length === 0) {
      root = root.child(
        div().absolute().left(0).top(0).w_full().h(G).flex().items_center().justify_center().px(8)
          .text_size(SMALL).font_family(FONT_SMALL).line_height(LH(SMALL)).text_color(DARK).text_center()
          .child(tr("Chưa có Pokémon nào. Mỗi agent bạn mở sẽ xuất hiện ở đây.", "No Pokémon yet. Every agent you open will appear here.")),
      ).child(optRow);
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

    // A single unified scale factor for all Pokémon in the field so that all
    // Pokémon remain in exact relative proportion to each other, scaling up
    // uniformly when the bottom bar is taller.
    const avail = Math.max(20, G - 20);
    let maxTallest = 56; // baseline reference for standard tall Pokémon
    for (const a of list) {
      const meta = walkOf(monKey(a.pane));
      if (meta) {
        const sc = (meta.scale ?? 2) / 2;
        const t = Math.max(...WALKS.map((k) => meta[k].box.h)) / sc;
        if (t > maxTallest) maxTallest = t;
      }
    }
    const sharedScale = avail / maxTallest;

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
          openFight(a.address, a.pane);
        });
      const fx = this.fx?.address === a.address ? this.fx : null;
      let geo = null;

      let headY = G - POKEBALL;
      if (meta) {
        const sc = (meta.scale ?? 2) / 2;
        const k = sharedScale / sc;
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
        geo = { w: bw, h: bh };
        const left = SLOT / 2 - (bx + bw / 2);
        const top = G - (by + bh);
        col = col
          .child(div().absolute().left(SLOT / 2 - shadowW / 2).top(G - 4).w(shadowW).h(6).rounded_full().bg(M.crust).opacity(0.35))
          .child(withMotion(image(s.path).absolute().left(left).top(top).w(s.w * k).h(s.h * k), fx, m, { left, top }));
      } else {
        // Art still downloading: a Poké Ball waits in its place, wiggling in place.
        const shadow = div()
          .absolute()
          .left(SLOT / 2 - 10)
          .top(G - 4)
          .w(20)
          .h(6)
          .rounded_full()
          .bg(M.crust)
          .opacity(0.35)
          .loop("opacity", { from: 0.2, to: 0.4, period: 1000 });

        const ball = div()
          .absolute()
          .left(SLOT / 2 - POKEBALL / 2)
          .top(G - POKEBALL)
          .loop("top", { from: G - POKEBALL, to: G - POKEBALL - 3, period: 1000, easing: "ease-out" })
          .child(
            div()
              .relative()
              .loop("left", { from: -2, to: 2, period: 200, easing: "ease-in-out" })
              .child(
                div()
                  .relative()
                  .loop("left", { from: -1, to: 1, period: 250, easing: "ease-in-out" })
                  .child(pokeballStill(POKEBALL))
              )
          );

        col = col.child(shadow).child(ball);
        geo = { w: POKEBALL, h: POKEBALL };
      }

      if (fx) col = col.children(castParts(fx, m, G, geo));
      const bubble = fx ? movePill(fx) : moodBubble(mood, SMALL);
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

    // The strongest moves flash the whole field once.
    if (this.fx && this.fx.tier >= 3 && this.mons[this.fx.address]) {
      root = root.child(
        div().id(`fx-flash-${this.fx.at}`).absolute().left(0).top(0).size_full().bg(M.text)
          .opacity(this.fx.phase ? 0 : 0.45)
          .transition("opacity", { duration: 600, easing: "ease-out" }),
      );
    }

    for (const p of this.pops) {
      const on = p.phase === 1;
      const size = on ? 36 : 14;
      root = root.child(
        div()
          .id(`pop-${p.id}`)
          .absolute()
          .left(p.x - size / 2)
          .top(p.y - size / 2)
          .w(size)
          .h(size)
          .rounded_full()
          .bg("#ffffff")
          .opacity(on ? 0 : 0.9)
          .transition("left", { duration: 300, easing: "ease-out" })
          .transition("top", { duration: 300, easing: "ease-out" })
          .transition("width", { duration: 300, easing: "ease-out" })
          .transition("height", { duration: 300, easing: "ease-out" })
          .transition("opacity", { duration: 300, easing: "ease-out" }),
      );
    }

    root = root.child(optRow);
    return frame(root, { full: true, pad: 0 });
  }
}

// The Pokémon's own motion while it plays a move (fx.js motion), from its
// resting left/top.
function withMotion(el, fx, m, base) {
  if (!fx) return el;
  const dir = m.dir === "r" ? 1 : -1;
  const mo = effectOf(fx, { cx: SLOT / 2, mouth: 0, head: 0, ground: 0, w: 0, h: 0, dir, fieldTop: 0 }).motion;
  if (!mo) return el;
  if (mo.prop === "opacity") return el.loop("opacity", { from: mo.from, to: mo.to, period: mo.period, easing: "linear" });
  const b = base[mo.prop] ?? 0;
  return el.loop(mo.prop, { from: b + mo.from, to: b + mo.to, period: mo.period, easing: "ease-in-out" });
}

// The particles of a move, in the Pokémon's column.
function castParts(fx, m, G, geo) {
  const dir = m.dir === "r" ? 1 : -1;
  const g = { cx: SLOT / 2, ground: G, head: G - geo.h, mouth: G - geo.h * 0.6, w: geo.w, h: geo.h, dir, fieldTop: 0 };
  const { parts } = effectOf(fx, g);
  const on = fx.phase === 1;
  return parts.map((p, i) => {
    const pol = { duration: Math.max(1, Math.round(p.dur)), delay: Math.round(p.delay ?? 0), easing: p.easing ?? "ease-out" };
    const [x, y] = on ? p.to : p.from;
    let el = div()
      .id(`fx-${fx.at}-${i}`)
      .absolute()
      .left(x)
      .top(y)
      .w(on ? p.w1 ?? p.w : p.w)
      .h(on ? p.h1 ?? p.h : p.h)
      .rounded(p.round ?? 0)
      .opacity(on ? p.op1 : p.op0);
    el = p.ring ? el.border(2).border_color(p.color) : el.bg(p.color);
    for (const prop of ["left", "top", "width", "height", "opacity"]) el = el.transition(prop, pol);
    return el;
  });
}

// The move's name over the Pokémon, in its type's color: "THUNDERBOLT!".
function movePill(fx) {
  return div()
    .flex_none()
    .px(5)
    .rounded(6)
    .bg(TYPE_COLOR[fx.type] ?? M.text)
    .text_color(M.crust)
    .text_size(SMALL)
    .font_family(FONT_SMALL)
    .line_height(LH(SMALL))
    .whitespace_nowrap()
    .child(`${fx.name}!`);
}
