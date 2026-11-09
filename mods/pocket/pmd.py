#!/usr/bin/env python3
# Pocket: cuts one facing of a PMD SpriteCollab animation sheet into a looping,
# pixel-scaled GIF (Pillow; replaces the ImageMagick step of
# mathieucroset/herdr-pokemon-agents) and prints its size and the box its
# visible pixels fill, as JSON: {"w","h","box":{"x","y","w","h"}}.
# Usage: pmd.py <sheet.png> <frameW> <frameH> <row> <durations,comma,sep> <scale> <out.gif>
import json
import sys
from PIL import Image

sheet, fw, fh, row, durs, scale, out = sys.argv[1:8]
fw, fh, row, scale = int(fw), int(fh), int(row), int(scale)
durations = [int(d) for d in durs.split(",") if d] or [10]

im = Image.open(sheet).convert("RGBA")
rows = max(1, im.height // fh)
cols = max(1, im.width // fw)
y = min(row, rows - 1) * fh
n = min(cols, len(durations))
frames, ms = [], []
box = None
for i in range(n):
    f = im.crop((i * fw, y, (i + 1) * fw, y + fh))
    bb = f.getbbox()
    if bb:
        box = bb if box is None else (min(box[0], bb[0]), min(box[1], bb[1]), max(box[2], bb[2]), max(box[3], bb[3]))
    frames.append(f.resize((fw * scale, fh * scale), Image.NEAREST))
    # Durations are game frames (1/60 s).
    ms.append(max(20, round(durations[i] * 1000 / 60)))
frames[0].save(out, save_all=True, append_images=frames[1:], duration=ms, loop=0, disposal=2, optimize=False)
if box is None:
    box = (0, 0, fw, fh)
x0, y0, x1, y1 = (v * scale for v in box)
print(json.dumps({"w": fw * scale, "h": fh * scale, "box": {"x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0}}))
