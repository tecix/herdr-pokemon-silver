#!/usr/bin/env python3
# Draws the loading ball glyph (mods/pocket/glyphs/pokeball.svg) at install
# time: a 16x16 pixel circle, red top, light bottom, dark band and outline, a
# button in the middle. Computed from circle math, so the repo ships no image
# of it. Usage: python3 tools/make-pokeball.py > mods/pocket/glyphs/pokeball.svg
OUTLINE = "#181926"  # Catppuccin Macchiato crust
TOP = "#ed8796"      # red
BOTTOM = "#cad3f5"   # text
SHINE = "#f4dbd6"    # rosewater

N = 16
c = (N - 1) / 2
r = N / 2 - 0.3
px = {}
for y in range(N):
    for x in range(N):
        d = ((x - c) ** 2 + (y - c) ** 2) ** 0.5
        if d > r:
            continue
        if d > r - 1.2:
            px[(x, y)] = OUTLINE
        elif abs(y - c) < 1:
            px[(x, y)] = OUTLINE
        else:
            px[(x, y)] = TOP if y < c else BOTTOM
# Button: a dark ring with a light center.
for y in range(N):
    for x in range(N):
        d = ((x - c) ** 2 + (y - c) ** 2) ** 0.5
        if d <= 1.6:
            px[(x, y)] = BOTTOM
        elif d <= 2.7:
            px[(x, y)] = OUTLINE
# A highlight on the top half.
for x, y in ((4, 3), (5, 3), (3, 4), (3, 5)):
    if px.get((x, y)) == TOP:
        px[(x, y)] = SHINE

rects = "".join(f'<rect x="{x}" y="{y}" width="1" height="1" fill="{f}"/>' for (x, y), f in sorted(px.items(), key=lambda k: (k[0][1], k[0][0])))
print(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {N} {N}" width="{N}" height="{N}" shape-rendering="crispEdges">{rects}</svg>')
