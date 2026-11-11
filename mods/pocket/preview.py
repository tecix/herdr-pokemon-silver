#!/usr/bin/env python3
# Generates a stylized, high-detail pixel-art thumbnail for Herdr layout settings.
import sys

M = {
    "crust": "#181926",
    "mantle": "#1e2030",
    "base": "#24273a",
    "surface0": "#363a4f",
    "surface1": "#494d64",
    "surface2": "#5b6078",
    "overlay": "#6e738d",
    "sub": "#a5adcb",
    "text": "#cad3f5",
    "lavender": "#b7bdf8",
    "mauve": "#c6a0f6",
    "red": "#ed8796",
    "peach": "#f5a97f",
    "yellow": "#eed49f",
    "green": "#a6da95",
    "teal": "#8bd5ca",
    "blue": "#8aadf4",
    "pink": "#f5bde6",
    "white": "#ffffff",
}

svg = []
def add(line): svg.append(line)

W, H = 320, 200
add(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" shape-rendering="crispEdges">')

# 1. Background
add(f'  <rect width="{W}" height="{H}" fill="{M["mantle"]}"/>')

# 2. Top Bar (Gen 2 status strip)
add(f'  <rect x="0" y="0" width="{W}" height="12" fill="{M["crust"]}"/>')
add(f'  <line x1="0" y1="12" x2="{W}" y2="12" stroke="{M["surface0"]}" stroke-width="1"/>')

# Title / Place badge
# Mini pokeball icon
add(f'  <circle cx="7" cy="6" r="3.5" fill="{M["red"]}"/>')
add(f'  <path d="M3.5 6 a3.5 3.5 0 0 0 7 0 z" fill="{M["white"]}"/>')
add(f'  <line x1="3.5" y1="6" x2="10.5" y2="6" stroke="{M["crust"]}" stroke-width="0.8"/>')
add(f'  <circle cx="7" cy="6" r="1.2" fill="{M["crust"]}"/>')
add(f'  <circle cx="7" cy="6" r="0.6" fill="{M["white"]}"/>')
# Place name
add(f'  <rect x="13" y="4.5" width="46" height="3" rx="1" fill="{M["lavender"]}"/>')

# Tabs (#main active pill, + button)
add(f'  <rect x="63" y="2.5" width="28" height="7" rx="2" fill="{M["surface1"]}" stroke="{M["mauve"]}" stroke-width="0.8"/>')
add(f'  <circle cx="67" cy="6" r="1.2" fill="{M["blue"]}"/>')
add(f'  <rect x="71" y="4.5" width="16" height="3" rx="1" fill="{M["text"]}"/>')

add(f'  <rect x="94" y="2.5" width="9" height="7" rx="2" fill="{M["crust"]}" stroke="{M["surface2"]}" stroke-width="0.8"/>')
add(f'  <line x1="98.5" y1="4.5" x2="98.5" y2="7.5" stroke="{M["sub"]}" stroke-width="0.8"/>')
add(f'  <line x1="97" y1="6" x2="100" y2="6" stroke="{M["sub"]}" stroke-width="0.8"/>')

# 8 Gym Badges (diamond gems in full jewel colors)
badges = [M["overlay"], M["blue"], M["peach"], M["green"], M["pink"], M["yellow"], M["red"], M["teal"]]
for i, c in enumerate(badges):
    bx = 175 + i * 6
    by = 6
    add(f'  <polygon points="{bx},{by-2.5} {bx+2},{by} {bx},{by+2.5} {bx-2},{by}" fill="{c}"/>')

# Clock
add(f'  <rect x="226" y="4.5" width="22" height="3" rx="1" fill="{M["peach"]}"/>')

# Action buttons (STAMINA, QUESTS, MAIL with unread pip, MENU)
add(f'  <rect x="252" y="3" width="16" height="6" rx="1.5" fill="{M["surface0"]}" stroke="{M["surface2"]}" stroke-width="0.6"/>')
add(f'  <rect x="254" y="5" width="12" height="2" rx="0.5" fill="{M["green"]}"/>')

add(f'  <rect x="271" y="3" width="14" height="6" rx="1.5" fill="{M["surface0"]}" stroke="{M["surface2"]}" stroke-width="0.6"/>')
add(f'  <rect x="273" y="5" width="10" height="2" rx="0.5" fill="{M["sub"]}"/>')

# Mail with red badge
add(f'  <rect x="288" y="3" width="14" height="6" rx="1.5" fill="{M["surface0"]}" stroke="{M["surface2"]}" stroke-width="0.6"/>')
add(f'  <rect x="290" y="5" width="10" height="2" rx="0.5" fill="{M["text"]}"/>')
add(f'  <circle cx="301" cy="3.5" r="2" fill="{M["red"]}"/>')

# Menu in gold
add(f'  <rect x="304" y="3" width="13" height="6" rx="1.5" fill="{M["surface0"]}" stroke="{M["yellow"]}" stroke-width="0.8"/>')
add(f'  <rect x="306" y="5" width="9" height="2" rx="0.5" fill="{M["yellow"]}"/>')

# -------------------------------------------------------------
# 3. Sidebar (PARTY cards + TOWN MAP)
# -------------------------------------------------------------
add(f'  <rect x="4" y="15" width="70" height="152" rx="2" fill="{M["crust"]}" stroke="{M["surface0"]}" stroke-width="0.8"/>')
add(f'  <rect x="8" y="18" width="22" height="3" rx="1" fill="{M["yellow"]}"/>') # PARTY header

# Pixel Pokémon icons helper
def draw_pixels(x0, y0, grid, colormap, px_size=1):
    for r_idx, row in enumerate(grid):
        for c_idx, ch in enumerate(row):
            if ch in colormap:
                add(f'  <rect x="{x0 + c_idx*px_size}" y="{y0 + r_idx*px_size}" width="{px_size}" height="{px_size}" fill="{colormap[ch]}"/>')

# Party Card 1: Charmander (Focused, double border with Mauve)
add(f'  <rect x="7" y="24" width="64" height="26" rx="2" fill="{M["base"]}" stroke="{M["mauve"]}" stroke-width="1.2"/>')
add(f'  <rect x="9" y="26" width="60" height="22" rx="1" fill="none" stroke="{M["surface1"]}" stroke-width="0.6"/>')
# Charmander sprite (10x10)
char_map = {"O": M["peach"], "Y": M["yellow"], "R": M["red"], "B": M["crust"], "W": M["white"]}
char_grid = [
    "...OOO....",
    "..OBBOO...",
    "..OOWOO...",
    "..OOOOO...",
    "...OOOYR..",
    "..OOOOYR..",
    ".OOOOOYYR.",
    ".O.OO.....",
    "OO.OO.....",
    "..........",
]
draw_pixels(11, 28, char_grid, char_map, px_size=1.1)
# Name & tags
add(f'  <rect x="25" y="28" width="18" height="2.5" rx="1" fill="{M["text"]}"/>')
add(f'  <rect x="46" y="28" width="18" height="2.5" rx="1" fill="{M["blue"]}"/>') # Gemini badge
# Space name
add(f'  <rect x="25" y="32" width="26" height="2" rx="0.5" fill="{M["sub"]}"/>')
# HP bar: Yellow HP label + green bar
add(f'  <rect x="25" y="36.5" width="4" height="2" rx="0.5" fill="{M["yellow"]}"/>')
add(f'  <rect x="30" y="36.5" width="34" height="2" rx="0.5" fill="{M["crust"]}"/>')
add(f'  <rect x="30" y="36.5" width="31" height="2" rx="0.5" fill="{M["green"]}"/>')
# EXP bar: Blue
add(f'  <rect x="25" y="40" width="39" height="1" rx="0.5" fill="{M["crust"]}"/>')
add(f'  <rect x="25" y="40" width="28" height="1" rx="0.5" fill="{M["blue"]}"/>')

# Party Card 2: Pikachu (Claude Code)
add(f'  <rect x="7" y="53" width="64" height="26" rx="2" fill="{M["base"]}" stroke="{M["surface2"]}" stroke-width="0.8"/>')
pika_map = {"Y": M["yellow"], "B": M["crust"], "R": M["red"], "W": M["white"], "O": M["peach"]}
pika_grid = [
    "B...B.....",
    "YY.YY.....",
    "YYYYY.....",
    "YBYBY.....",
    "YYWYY.....",
    "RYYYR.Y...",
    "YYYYYYY...",
    ".YYYY.....",
    ".Y..Y.....",
    "..........",
]
draw_pixels(11, 57, pika_grid, pika_map, px_size=1.1)
add(f'  <rect x="25" y="57" width="22" height="2.5" rx="1" fill="{M["text"]}"/>')
add(f'  <rect x="49" y="57" width="15" height="2.5" rx="1" fill="{M["peach"]}"/>') # Claude badge
add(f'  <rect x="25" y="61" width="24" height="2" rx="0.5" fill="{M["sub"]}"/>')
add(f'  <rect x="25" y="65.5" width="4" height="2" rx="0.5" fill="{M["yellow"]}"/>')
add(f'  <rect x="30" y="65.5" width="34" height="2" rx="0.5" fill="{M["crust"]}"/>')
add(f'  <rect x="30" y="65.5" width="28" height="2" rx="0.5" fill="{M["green"]}"/>')
add(f'  <rect x="25" y="69" width="39" height="1" rx="0.5" fill="{M["crust"]}"/>')
add(f'  <rect x="25" y="69" width="15" height="1" rx="0.5" fill="{M["blue"]}"/>')

# Party Card 3: Gengar (Blocked/waiting on you: red border indicator)
add(f'  <rect x="7" y="82" width="64" height="26" rx="2" fill="{M["base"]}" stroke="{M["red"]}" stroke-width="1"/>')
gengar_map = {"P": M["mauve"], "R": M["red"], "W": M["white"], "B": M["crust"]}
gengar_grid = [
    "P...P.....",
    "PPPPPPP...",
    "PRPPRPP...",
    "PPPPPPP...",
    "PWWWWWP...",
    "P.P.P.P...",
    "PPPPPPP...",
    ".PP.PP....",
    "PP...PP...",
    "..........",
]
draw_pixels(11, 86, gengar_grid, gengar_map, px_size=1.1)
add(f'  <rect x="25" y="86" width="24" height="2.5" rx="1" fill="{M["text"]}"/>')
# WAITING tag in red
add(f'  <rect x="52" y="86" width="12" height="3" rx="1" fill="{M["red"]}"/>')
add(f'  <rect x="25" y="90" width="20" height="2" rx="0.5" fill="{M["sub"]}"/>')
add(f'  <rect x="25" y="94.5" width="4" height="2" rx="0.5" fill="{M["yellow"]}"/>')
add(f'  <rect x="30" y="94.5" width="34" height="2" rx="0.5" fill="{M["crust"]}"/>')
add(f'  <rect x="30" y="94.5" width="16" height="2" rx="0.5" fill="{M["yellow"]}"/>') # moderate HP
add(f'  <rect x="25" y="98" width="39" height="1" rx="0.5" fill="{M["crust"]}"/>')
add(f'  <rect x="25" y="98" width="32" height="1" rx="0.5" fill="{M["blue"]}"/>')

# Town Map box at bottom of sidebar
add(f'  <rect x="7" y="112" width="64" height="51" rx="2" fill="{M["base"]}" stroke="{M["surface2"]}" stroke-width="0.8"/>')
add(f'  <rect x="11" y="116" width="24" height="2.5" rx="1" fill="{M["yellow"]}"/>')
# Towns with retro indicator dots
add(f'  <circle cx="14" cy="125" r="1.5" fill="{M["mauve"]}"/>')
add(f'  <rect x="18" y="123.5" width="46" height="2.5" rx="0.5" fill="{M["text"]}"/>')
add(f'  <circle cx="14" cy="133" r="1.5" fill="{M["blue"]}"/>')
add(f'  <rect x="18" y="131.5" width="36" height="2.5" rx="0.5" fill="{M["sub"]}"/>')
add(f'  <circle cx="14" cy="141" r="1.5" fill="{M["teal"]}"/>')
add(f'  <rect x="18" y="139.5" width="40" height="2.5" rx="0.5" fill="{M["sub"]}"/>')
add(f'  <circle cx="14" cy="149" r="1.5" fill="{M["surface2"]}"/>')
add(f'  <rect x="18" y="147.5" width="30" height="2.5" rx="0.5" fill="{M["overlay"]}"/>')

# -------------------------------------------------------------
# 4. Center Main Pane (Terminal + Pokémon Art Window)
# -------------------------------------------------------------
add(f'  <rect x="78" y="15" width="238" height="152" rx="3" fill="{M["base"]}" stroke="{M["mauve"]}" stroke-width="1.2"/>')
add(f'  <rect x="79" y="16" width="236" height="12" fill="{M["crust"]}"/>')
add(f'  <line x1="78" y1="28" x2="316" y2="28" stroke="{M["mauve"]}" stroke-width="0.8"/>')

# Pane header contents
# Lead pokemon icon
draw_pixels(83, 17, char_grid, char_map, px_size=0.9)
add(f'  <rect x="94" y="20.5" width="44" height="3" rx="1" fill="{M["text"]}"/>')
# Model pill
add(f'  <rect x="142" y="18.5" width="38" height="6.5" rx="1.5" fill="{M["surface1"]}" stroke="{M["blue"]}" stroke-width="0.6"/>')
add(f'  <rect x="146" y="20.5" width="30" height="2.5" rx="0.5" fill="{M["blue"]}"/>')
# HP bar in header
add(f'  <rect x="184" y="21" width="3" height="2" rx="0.5" fill="{M["yellow"]}"/>')
add(f'  <rect x="188" y="21" width="36" height="2" rx="0.5" fill="{M["crust"]}"/>')
add(f'  <rect x="188" y="21" width="32" height="2" rx="0.5" fill="{M["green"]}"/>')
# Window controls (right)
add(f'  <rect x="296" y="19" width="5" height="5" fill="none" stroke="{M["sub"]}" stroke-width="0.8"/>')
add(f'  <rect x="304" y="19" width="5" height="5" fill="none" stroke="{M["sub"]}" stroke-width="0.8"/>')
add(f'  <line x1="304" y1="21.5" x2="309" y2="21.5" stroke="{M["sub"]}" stroke-width="0.8"/>')

# Terminal body
# Watermark / Stylized Pokémon Game Boy emblem in center right of terminal
add(f'  <g opacity="0.12">')
add(f'    <circle cx="250" cy="90" r="38" fill="none" stroke="{M["mauve"]}" stroke-width="4"/>')
add(f'    <line x1="212" y1="90" x2="288" y2="90" stroke="{M["mauve"]}" stroke-width="4"/>')
add(f'    <circle cx="250" cy="90" r="14" fill="{M["base"]}" stroke="{M["mauve"]}" stroke-width="4"/>')
add(f'    <circle cx="250" cy="90" r="6" fill="{M["mauve"]}"/>')
add(f'  </g>')

# Stylized terminal lines (rich syntax & retro CLI output)
# Logo / greeting banner in pixel blocks
arch_colors = [M["red"], M["peach"], M["yellow"], M["green"], M["teal"], M["blue"], M["mauve"]]
for i, ac in enumerate(arch_colors):
    add(f'  <rect x="{84 + i*4}" y="{34 + abs(i-3)*1.5}" width="3" height="8" rx="0.8" fill="{ac}"/>')

add(f'  <rect x="116" y="34" width="65" height="3" rx="1" fill="{M["text"]}"/>') # "Antigravity CLI 1.5.5"
add(f'  <rect x="116" y="39" width="85" height="2.5" rx="0.8" fill="{M["sub"]}"/>')
add(f'  <rect x="116" y="43.5" width="55" height="2.5" rx="0.8" fill="{M["blue"]}"/>')

# Prompt line
add(f'  <polygon points="84,52 87,54 84,56" fill="{M["green"]}"/>')
add(f'  <rect x="90" y="52.5" width="48" height="3" rx="0.8" fill="{M["green"]}"/>')
add(f'  <rect x="142" y="52.5" width="60" height="3" rx="0.8" fill="{M["text"]}"/>')

# Output syntax lines
code_lines = [
    (84, 60, 14, M["mauve"]), (102, 60, 36, M["blue"]), (142, 60, 52, M["text"]),
    (88, 65, 28, M["teal"]), (120, 65, 60, M["sub"]),
    (88, 70, 42, M["yellow"]), (134, 70, 75, M["green"]),
    (88, 75, 34, M["peach"]), (126, 75, 45, M["text"]),
    (84, 82, 18, M["mauve"]), (106, 82, 54, M["blue"]), (164, 82, 38, M["text"]),
    (88, 87, 85, M["sub"]),
    (88, 92, 110, M["text"]),
    (88, 97, 65, M["green"]),
]
for lx, ly, lw, lc in code_lines:
    add(f'  <rect x="{lx}" y="{ly}" width="{lw}" height="2.4" rx="0.6" fill="{lc}"/>')

# Terminal interactive box / assistant card
add(f'  <rect x="84" y="104" width="224" height="28" rx="2" fill="{M["surface0"]}" stroke="{M["surface2"]}" stroke-width="0.8"/>')
add(f'  <rect x="84" y="104" width="2.5" height="28" fill="{M["blue"]}"/>') # left accent
add(f'  <circle cx="92" cy="112" r="2.5" fill="{M["green"]}"/>')
add(f'  <rect x="98" y="110.5" width="90" height="3" rx="0.8" fill="{M["text"]}"/>')
add(f'  <rect x="98" y="115.5" width="140" height="2.5" rx="0.8" fill="{M["sub"]}"/>')
add(f'  <rect x="98" y="120" width="115" height="2.5" rx="0.8" fill="{M["sub"]}"/>')
add(f'  <rect x="98" y="124.5" width="4" height="3" fill="{M["mauve"]}"/>') # blinking block cursor

# Bottom status bar of terminal
add(f'  <rect x="84" y="137" width="224" height="14" rx="1.5" fill="{M["crust"]}"/>')
add(f'  <rect x="88" y="141" width="12" height="6" rx="1" fill="{M["surface1"]}"/>')
add(f'  <rect x="103" y="142.5" width="30" height="3" rx="0.8" fill="{M["sub"]}"/>')
add(f'  <rect x="136" y="142.5" width="40" height="3" rx="0.8" fill="{M["green"]}"/>')
add(f'  <rect x="238" y="140" width="66" height="8" rx="2" fill="{M["surface1"]}" stroke="{M["blue"]}" stroke-width="0.6"/>')
add(f'  <rect x="242" y="142.5" width="58" height="3" rx="0.8" fill="{M["blue"]}"/>')

# -------------------------------------------------------------
# 5. Bottom Strip (Field Island + Message Panel)
# -------------------------------------------------------------
# Left: Field island
add(f'  <rect x="4" y="170" width="198" height="26" rx="2" fill="{M["crust"]}" stroke="{M["surface2"]}" stroke-width="0.8"/>')
# Lush grassy ground line
add(f'  <line x1="6" y1="189" x2="200" y2="189" stroke="{M["surface1"]}" stroke-width="1"/>')
add(f'  <line x1="6" y1="188.5" x2="200" y2="188.5" stroke="{M["green"]}" stroke-width="0.8"/>')
# Grass tufts & flowers
for gx in [15, 38, 62, 95, 125, 155, 182]:
    add(f'  <line x1="{gx}" y1="188.5" x2="{gx-1}" y2="186" stroke="{M["green"]}" stroke-width="0.8"/>')
    add(f'  <line x1="{gx+1}" y1="188.5" x2="{gx+2}" y2="185.5" stroke="{M["green"]}" stroke-width="0.8"/>')
add(f'  <circle cx="48" cy="187" r="1" fill="{M["pink"]}"/>')
add(f'  <circle cx="108" cy="187" r="1" fill="{M["yellow"]}"/>')
add(f'  <circle cx="140" cy="187" r="1" fill="{M["white"]}"/>')

# Roaming Pikachu on the field
draw_pixels(22, 178, pika_grid, pika_map, px_size=1.0)
add(f'  <rect x="23" y="189.5" width="8" height="1" rx="0.5" fill="{M["surface0"]}"/>') # shadow

# Roaming Bulbasaur on the field
bulba_map = {"T": M["teal"], "G": M["green"], "D": M["surface1"], "R": M["red"], "W": M["white"]}
bulba_grid = [
    "...GG.....",
    "..GGGG....",
    ".TTTTTT...",
    "TTWTTWT...",
    "TTRTTWT...",
    "TTTTTTT...",
    "TT.TT.T...",
    ".T..T.....",
]
draw_pixels(74, 180, bulba_grid, bulba_map, px_size=1.0)
add(f'  <rect x="74" y="189.5" width="8" height="1" rx="0.5" fill="{M["surface0"]}"/>')

# Sleeping Charizard on the field (with floating 'z' 'Z')
char_sleep_map = {"O": M["peach"], "Y": M["yellow"], "B": M["crust"], "R": M["red"]}
char_sleep_grid = [
    "....OO....",
    "...OOOO.R.",
    "..OBBOOOYR",
    ".OOOOOOOOO",
    "OOOOOOOOOO",
    ".OO...OO..",
]
draw_pixels(128, 182, char_sleep_grid, char_sleep_map, px_size=1.1)
add(f'  <rect x="127" y="189.5" width="13" height="1" rx="0.5" fill="{M["surface0"]}"/>')
# Floating sleep 'z Z'
add(f'  <path d="M142 176 h3 l-3 3 h3" stroke="{M["lavender"]}" stroke-width="0.8" fill="none"/>')
add(f'  <path d="M147 173 h2.2 l-2.2 2.2 h2.2" stroke="{M["lavender"]}" stroke-width="0.6" fill="none"/>')

# Detailed Poké Ball resting in the field
add(f'  <circle cx="180" cy="183.5" r="4.5" fill="{M["red"]}"/>')
add(f'  <path d="M175.5 183.5 a4.5 4.5 0 0 0 9 0 z" fill="{M["white"]}"/>')
add(f'  <line x1="175.5" y1="183.5" x2="184.5" y2="183.5" stroke="{M["crust"]}" stroke-width="1"/>')
add(f'  <circle cx="180" cy="183.5" r="1.6" fill="{M["crust"]}"/>')
add(f'  <circle cx="180" cy="183.5" r="0.8" fill="{M["white"]}"/>')
add(f'  <circle cx="178" cy="181.5" r="0.8" fill="{M["white"]}" opacity="0.6"/>') # shine highlight
add(f'  <rect x="177" y="188.5" width="6" height="1" rx="0.5" fill="{M["surface0"]}"/>')

# -------------------------------------------------------------
# Right: Message Panel (Classic Game Boy RPG Dialogue Box)
# -------------------------------------------------------------
add(f'  <rect x="206" y="170" width="110" height="26" rx="2" fill="{M["base"]}" stroke="{M["mauve"]}" stroke-width="1.2"/>')
add(f'  <rect x="208" y="172" width="106" height="22" rx="1" fill="none" stroke="{M["white"]}" stroke-width="0.7"/>')

# Gen 3 Encounter Pokémon on Pedestal
add(f'  <ellipse cx="220" cy="189.5" rx="9" ry="2" fill="{M["surface1"]}"/>') # battle platform
draw_pixels(214, 174, char_grid, char_map, px_size=1.1)

# Encounter text & choices
add(f'  <rect x="230" y="175" width="68" height="2.5" rx="0.5" fill="{M["text"]}"/>') # "Wild AGENT appeared!"
add(f'  <rect x="230" y="179" width="45" height="2" rx="0.5" fill="{M["sub"]}"/>') # "Waiting for reply..."

# RPG choice with triangle cursor
add(f'  <polygon points="230,185.5 233,187 230,188.5" fill="{M["mauve"]}"/>')
add(f'  <rect x="235" y="185.5" width="22" height="2.5" rx="0.5" fill="{M["text"]}"/>') # REPLY
add(f'  <rect x="264" y="185.5" width="18" height="2.5" rx="0.5" fill="{M["sub"]}"/>') # RUN
add(f'  <polygon points="307,189 310,189 308.5,191" fill="{M["yellow"]}"/>') # blinking more arrow

add('</svg>')

with open("layouts/pocket.svg", "w") as f:
    f.write("\n".join(svg) + "\n")
with open("layouts/pocket-symbol.svg", "w") as f:
    f.write("\n".join(svg) + "\n")

print("Generated stylized layouts/pocket.svg and layouts/pocket-symbol.svg!")
