# Draws layouts/pocket.svg (the layout picker preview): a 320x200 schematic of the pocket layout.
# python3 mods/pocket/preview.py > layouts/pocket.svg
import sys
M = dict(text="#cad3f5", sub="#a5adcb", ov="#6e738d", s2="#5b6078", s1="#494d64", s0="#363a4f",
         base="#24273a", mantle="#1e2030", crust="#181926", lav="#b7bdf8", mauve="#c6a0f6",
         red="#ed8796", green="#a6da95", yellow="#eed49f", blue="#8aadf4", peach="#f5a97f",
         teal="#8bd5ca", pink="#f5bde6", sky="#91d7e3")
out = []
def r(x, y, w, h, fill, stroke=None, sw=1, rx=0, op=None):
    a = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}"'
    if stroke: a += f' stroke="{stroke}" stroke-width="{sw}"'
    if rx: a += f' rx="{rx}"'
    if op is not None: a += f' opacity="{op}"'
    out.append(a + "/>")
def box(x, y, w, h, edge=M["lav"], fill=M["base"], inner=M["s2"]):
    # Gen 2 text box: outer line, fill gap, thin inner line.
    r(x + .5, y + .5, w - 1, h - 1, fill, edge, 1, 1.5)
    r(x + 2.5, y + 2.5, w - 5, h - 5, fill, inner, .5)
def critter(x, y, body, eye=M["crust"], k=1):
    # A generic 8x7 pixel creature (not any real character).
    px = ["..XXXX..", ".XXXXXX.", "XXOXXOXX", "XXXXXXXX", ".XXXXXX.", ".X....X.", "XX....XX"]
    for j, row in enumerate(px):
        for i, c in enumerate(row):
            if c != ".": r(x + i * k, y + j * k, k, k, body if c == "X" else eye)
def hp(x, y, w, pct=.9, color=M["green"]):
    r(x, y, 4, 2, M["yellow"]); r(x + 5, y, w - 5, 2.4, M["crust"], M["s2"], .4); r(x + 5.6, y + .6, (w - 6.2) * pct, 1.2, color)

W, H = 320, 200
r(0, 0, W, H, M["mantle"])
# Top bar: place, tab pills, badges, clock, buttons.
r(0, 0, W, 12, M["crust"]); r(0, 11.5, W, .5, M["s0"])
r(4, 4, 4, 4, M["mauve"]); r(10, 4.5, 26, 3, M["lav"])
r(39.5, 2.5, 24, 7, M["s1"], M["mauve"], .6, 2); r(42, 5, 2, 2, M["blue"]); r(46, 5, 15, 2, M["text"])
r(66.5, 2.5, 7, 7, M["crust"], M["s2"], .6, 2); r(69, 5.5, 2, 1, M["sub"]); r(69.5, 5, 1, 2, M["sub"])
for i, c in enumerate([M["red"], M["peach"], None, None, None, None, None, None]):
    if c: r(222 + i * 5, 4.5, 3, 3, c)
    else: r(222.5 + i * 5, 5, 2, 2, "none", M["ov"], .5)
r(264, 4, 26, 4, M["peach"])
for i in range(3): r(298 + i * 7, 5, 4, 2 if i == 0 else 3, "none" if i else M["sub"], M["sub"] if i else None, .5)

# Sidebar: title, party cards, map.
r(5, 16, 22, 3, M["yellow"])
mons = [(M["pink"], "s"), (M["yellow"], "s"), (M["peach"], "w"), (M["teal"], "f")]
for n, (col, st) in enumerate(mons):
    y = 22 + n * 24
    focus = st == "f"
    box(3, y, 51, 22, M["mauve"] if focus else (M["red"] if n == 2 else M["lav"]), M["s0"] if focus else M["base"])
    if focus: r(5.5, y + 9, 1.5, 3, M["text"])
    r(9, y + 14, 12, 3, M["s1"], rx=1.5)
    critter(11, y + 7, col, k=1)
    r(24, y + 5, 20 if n != 3 else 16, 2.5, M["text"])
    r(24, y + 9.5, 3, 2, M["sub"]); r(28.5, y + 9.5, 8, 2, M["sub"]); r(44, y + 9.5, 7, 2, M["sub"])
    hp(24, y + 13.5, 27, [.95, .9, .97, .85][n])
    r(29, y + 17, 22, 1, M["crust"]); r(29, y + 17, [0, 0, 8, 0][n] or .01, 1, M["blue"])
    if n == 2: r(48, y + 4, 4, 4, M["red"], rx=2)
    if st == "s": r(47, y + 4, 4, 1.5, M["ov"])
r(5, 130, 18, 3, M["yellow"])
box(3, 136, 51, 35)
for i, w in enumerate([30, 26, 16, 22, 20]):
    y = 140 + i * 6
    r(10, y, w, 2.5, M["text"])
    if i == 1: r(6, y, 1.5, 2.5, M["text"])
    if i in (0, 2, 3): r(48, y + .4, 2, 2, [M["red"], 0, M["ov"], M["blue"]][i], rx=1)

# Main: one pane with its header, terminal text.
r(58.5, 15.5, 259, 156, M["base"], M["mauve"], 1, 2)
r(59, 16, 258, 9, M["s0"]); r(59, 24.5, 258, 1, M["mauve"])
critter(62, 17, M["peach"], k=1)
r(73, 19, 22, 3, M["text"]); r(98, 19.5, 3, 2, M["sub"]); r(102, 19.5, 18, 2, M["sub"])
hp(124, 19.5, 26)
r(154, 18.5, 14, 4, M["blue"], rx=1); r(156, 20, 10, 1, M["crust"])
r(171, 19.5, 16, 2, M["sub"])
for i, (x, w, c) in enumerate([(64, 120, M["sub"]), (64, 150, M["text"]), (64, 90, M["text"]), (64, 0, None), (68, 60, M["green"]), (68, 130, M["sub"]), (68, 104, M["sub"]), (64, 0, None), (64, 170, M["text"]), (64, 140, M["text"]), (64, 60, M["text"])]):
    if w: r(x, 31 + i * 7, w, 2.5, c)
r(64, 112, 196, 22, M["s0"]); r(64, 112, 1.5, 22, M["blue"])
r(70, 118, 2, 4, M["text"]); r(70, 127, 12, 2, M["ov"]); r(85, 127, 30, 2, M["text"])
r(64, 162, 30, 2, M["sub"]); r(232, 162, 30, 2, M["sub"])
r(266, 30, 46, 136, M["mantle"])
r(270, 35, 38, 2.5, M["text"]); r(270, 40, 30, 2.5, M["text"]); r(270, 50, 20, 2, M["sub"])

# Bottom: the field (they walk, sleep), the dialog box.
box(2, 175, 204, 23)
r(5, 190, 198, .8, M["s1"])
for x, h, c in [(40, 1.5, M["green"]), (90, 1, M["teal"]), (150, 1.5, M["green"]), (182, 1, M["teal"])]:
    r(x, 190 - h, 1, h, c)
for x, col, z in [(30, M["yellow"], True), (85, M["pink"], True), (125, M["peach"], False), (165, M["teal"], False)]:
    r(x - 1, 189.2, 10, 1.5, M["crust"], op=.4)
    critter(x, 182.5, col, k=1)
    if z: r(x + 2, 179, 4, 1.4, M["ov"])
    r(x - 4, 192.5, 1.5, 1.5, M["blue"] if not z else M["ov"], rx=.75); r(x - 1, 192.6, 13, 1.4, M["sub"])
box(208, 175, 110, 23, M["red"])
r(214.5, 182.5, 10, 4, M["s1"], rx=2)
critter(215, 178.5, M["peach"], k=1)
r(229, 179, 60, 3, M["text"]); r(229, 184.5, 40, 1.6, M["sub"])
r(229, 189.5, 1.5, 2.5, M["text"]); r(232, 189.8, 14, 2, M["text"]); r(252, 189.8, 9, 2, M["sub"])

sys.stdout.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" shape-rendering="crispEdges">\n  ' + "\n  ".join(out) + "\n</svg>\n")
