#!/usr/bin/env python3
# Pocket: pixel-doubles a PNG or animated GIF with nearest-neighbour, keeping the
# palette, transparency and frame timings. Usage: pixel.py <in> <out> [factor]
import sys
from PIL import Image, ImageSequence

src, out = sys.argv[1], sys.argv[2]
k = int(sys.argv[3]) if len(sys.argv) > 3 else 2
im = Image.open(src)
size = (im.width * k, im.height * k)
if getattr(im, "n_frames", 1) > 1:
    frames, durations = [], []
    for f in ImageSequence.Iterator(im):
        dur = f.info.get("duration", im.info.get("duration", 100))
        durations.append(max(10, int(round(dur))))
        frames.append(f.convert("RGBA").resize(size, Image.NEAREST))
    frames[0].save(out, save_all=True, append_images=frames[1:], duration=durations,
                   loop=0, disposal=2, optimize=False)
else:
    im.resize(size, Image.NEAREST).save(out)
