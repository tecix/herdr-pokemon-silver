#!/usr/bin/env python3
# Cuts the 18 Pokémon type icons out of JWNutz's "Pokemon icons" sheet
# (deviantart.com/jwnutz/art/Pokemon-icons-669595851, 992x1954, a 4-column
# grid of colored icons with their names under them on a dark background).
# The sheet is downloaded on first use (types.js); it never ships with the mod.
# Each icon: its cell, without the name under it, cropped to its pixels,
# centered on a square, background made transparent, saved as <out>/<type>.png
# at 64px (and <type>2.png at 128px).
#   python3 typecut.py <sheet.png> <out dir>
# Needs Pillow. Prints the types written, one per line.
import os
import sys

from PIL import Image

# Grid order on the sheet: (column, row) -> type key.
CELLS = [
    "grass", "fire", "water", "electric",
    "ice", "rock", "ground", "steel",
    "fighting", "dark", "ghost", "psychic",
    "fairy", "dragon", "bug", "poison",
    "flying", "normal",
]
# Row bands (y) on the 1954px sheet: each holds one row of icons and names.
ROWS = [(0, 300), (300, 595), (595, 880), (880, 1165), (1165, 1440)]
COLS = 4
SIZES = {"": 64, "2": 128}


def main():
    src, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    sheet = Image.open(src).convert("RGB")
    sw, sh = sheet.size
    sy = sh / 1954  # in case a scaled copy is given
    bg = sheet.getpixel((2, 2))
    px = sheet.load()

    def ink(x, y):
        r, g, b = px[x, y]
        return abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2])

    def runs(hits, gap):
        # [start, end] runs of True, joining runs split by fewer than `gap` misses.
        out = []
        for i, h in enumerate(hits):
            if not h:
                continue
            if out and i - out[-1][1] <= gap:
                out[-1][1] = i
            else:
                out.append([i, i])
        return out

    cells = {}
    for r, (ry0, ry1) in enumerate(ROWS):
        ry0, ry1 = int(ry0 * sy), min(sh, int(ry1 * sy))
        # Bands of inked rows across the whole row: the last one is the names.
        bands = runs([any(ink(x, y) > 60 for x in range(0, sw, 2)) for y in range(ry0, ry1)], 4)
        if len(bands) < 2:
            continue
        top, bottom = ry0 + bands[0][0], ry0 + bands[-2][1]
        ly0, ly1 = ry0 + bands[-1][0], ry0 + bands[-1][1]
        # The names: one run per column (the gaps between words are small).
        labels = runs([any(ink(x, y) > 60 for y in range(ly0, ly1 + 1)) for x in range(sw)], 20)
        centers = [(a + b) / 2 for a, b in labels][:COLS]
        # The icons' pieces, each given to the column whose name is nearest.
        pieces = runs([any(ink(x, y) > 60 for y in range(top, bottom + 1)) for x in range(sw)], 2)
        spans = {}
        for a, b in pieces:
            c = min(range(len(centers)), key=lambda k: abs(centers[k] - (a + b) / 2))
            lo, hi = spans.get(c, (a, b))
            spans[c] = (min(lo, a), max(hi, b))
        for c, (left, right) in spans.items():
            i = r * COLS + c
            if i >= len(CELLS):
                continue
            ys = [y for y in range(top, bottom + 1) if any(ink(x, y) > 60 for x in range(left, right + 1))]
            cells[CELLS[i]] = (left, ys[0], right, ys[-1])

    for key in CELLS:
        if key not in cells:
            continue
        left, top, right, bottom = cells[key]
        icon = sheet.crop((left, top, right + 1, bottom + 1))
        # Alpha from the distance to the background, so the edges stay smooth.
        rgba = Image.new("RGBA", icon.size)
        ip, op = icon.load(), rgba.load()
        for y in range(icon.size[1]):
            for x in range(icon.size[0]):
                r_, g_, b_ = ip[x, y]
                d = abs(r_ - bg[0]) + abs(g_ - bg[1]) + abs(b_ - bg[2])
                a = max(0, min(255, int((d - 20) * 255 / 120)))
                op[x, y] = (r_, g_, b_, a)
        side = max(rgba.size)
        square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        square.paste(rgba, ((side - rgba.size[0]) // 2, (side - rgba.size[1]) // 2))
        for suffix, size in SIZES.items():
            square.resize((size, size), Image.LANCZOS).save(os.path.join(out, f"{key}{suffix}.png"))
        print(key)


if __name__ == "__main__":
    main()
