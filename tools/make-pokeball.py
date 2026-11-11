#!/usr/bin/env python3
# Draws the loading ball glyph (data/pocket/ui/pokeball.svg) at install
# time: a round vector Poké Ball with real circle/path shapes.
# Red top, light bottom, dark band and outline, centered button, highlight.
# Usage: python3 tools/make-pokeball.py > ~/.config/herdr-app/data/pocket/ui/pokeball.svg
OUTLINE = "#181926"  # Catppuccin Macchiato crust
TOP = "#ed8796"      # red
BOTTOM = "#cad3f5"   # text
SHINE = "#f4dbd6"    # rosewater

svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
  <circle cx="8" cy="8" r="7.5" fill="{OUTLINE}"/>
  <path d="M 1.5 8 A 6.5 6.5 0 0 1 14.5 8 Z" fill="{TOP}"/>
  <path d="M 1.5 8 A 6.5 6.5 0 0 0 14.5 8 Z" fill="{BOTTOM}"/>
  <rect x="1" y="7.25" width="14" height="1.5" fill="{OUTLINE}"/>
  <ellipse cx="5" cy="4.5" rx="1.5" ry="0.9" transform="rotate(-35 5 4.5)" fill="{SHINE}"/>
  <circle cx="8" cy="8" r="2.6" fill="{OUTLINE}"/>
  <circle cx="8" cy="8" r="1.5" fill="{BOTTOM}"/>
</svg>"""
print(svg)
