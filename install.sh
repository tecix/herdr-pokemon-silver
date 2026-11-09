#!/bin/sh
# Installs the Pocket layout into the Herdr desktop app's home
# (~/.config/herdr-app, or $HERDR_APP_HOME): mods/pocket, layouts/pocket.*,
# themes/pocket.json. Herdr hot-reloads them. Pokémon art is not shipped: it is
# downloaded on first use (see README). Run again to update; your picks, EXP and
# downloaded art (shared state and data/pocket) are kept.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
dest=${HERDR_APP_HOME:-$HOME/.config/herdr-app}

command -v python3 >/dev/null || { echo "pocket: python3 is required" >&2; exit 1; }
python3 -c "import PIL" 2>/dev/null || echo "pocket: Pillow not found (pip install pillow): art stays 1x, walk GIFs are skipped"

mkdir -p "$dest/mods" "$dest/layouts" "$dest/themes"
if command -v rsync >/dev/null; then
  rsync -a --exclude '__pycache__' "$here/mods/pocket/" "$dest/mods/pocket/"
else
  mkdir -p "$dest/mods/pocket" && cp -R "$here/mods/pocket/." "$dest/mods/pocket/"
fi
python3 "$here/tools/make-pokeball.py" > "$dest/mods/pocket/glyphs/pokeball.svg"
cp "$here/layouts/pocket.json" "$here/layouts/pocket.svg" "$dest/layouts/"
cp "$here/themes/pocket.json" "$dest/themes/"

if command -v herdr-app >/dev/null; then
  herdr-app check "$dest/mods/pocket"
  echo "pocket: installed. Switch to it: herdr-app do layout.switch --name pocket"
else
  echo "pocket: installed in $dest (herdr-app not on PATH, check skipped)"
fi
