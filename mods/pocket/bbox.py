#!/usr/bin/env python3
# Pocket: the box the visible pixels of each image fill (all frames of a GIF
# together), as JSON: {"<file>": [x0, y0, x1, y1, width, height]}. Pillow.
import json, sys
from PIL import Image, ImageSequence

out = {}
for f in sys.argv[1:]:
    try:
        im = Image.open(f)
        box = None
        for fr in ImageSequence.Iterator(im):
            b = fr.convert("RGBA").getbbox()
            if b:
                box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
        out[f] = list(box or (0, 0, im.width, im.height)) + [im.width, im.height]
    except Exception:
        out[f] = None
print(json.dumps(out))
