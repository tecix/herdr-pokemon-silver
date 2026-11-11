#!/bin/sh
# Installs the Pocket layout into the Herdr desktop app's home
# (~/.config/herdr-app, or $HERDR_APP_HOME): mods/pocket, layouts/pocket.*,
# themes/pocket.json and themes/pocket-light.json. Herdr hot-reloads them. Pokémon art is not shipped: it is
# downloaded on first use (see README). Your picks, EXP and downloaded art
# (shared state and data/pocket) are kept.
#
#   ./install.sh          symlinks (default): the app runs this repo's files, so
#                         editing or `git pull`ing here updates Herdr at once
#   ./install.sh --copy   copies instead (run again to update)
set -eu
here=$(cd "$(dirname "$0")" && pwd)
dest=${HERDR_APP_HOME:-$HOME/.config/herdr-app}
mode=link
[ "${1:-}" = "--copy" ] && mode=copy

command -v python3 >/dev/null || { echo "pocket: python3 is required" >&2; exit 1; }
python3 -c "import PIL" 2>/dev/null || echo "pocket: Pillow not found (pip install pillow): art stays 1x, walk GIFs are skipped"

mkdir -p "$dest/mods" "$dest/layouts" "$dest/themes"

# Pictures and sounds first: Herdr loads none behind a symlink, so they are
# copied (both modes) to data/pocket/ui, where the mod loads them from, and the
# watcher copies them again when they change. It also draws the Poké Ball
# there (no image of it in the repo). Before the mod: a picture that failed to
# load stays missing until Herdr restarts.
HERDR_APP_HOME="$dest" python3 "$here/tools/watch.py" --assets

# A copied install (a real folder/file) is moved aside before linking, so
# nothing is lost; a link from an earlier run is just replaced.
backup=""
aside() {
  if [ -e "$1" ] && [ ! -L "$1" ]; then
    [ -n "$backup" ] || backup=$(mktemp -d "${TMPDIR:-/tmp}/pocket-backup-XXXXXX")
    mv "$1" "$backup/"
  fi
  rm -f "$1"
}

if [ "$mode" = link ]; then
  aside "$dest/mods/pocket"
  ln -s "$here/mods/pocket" "$dest/mods/pocket"
  for f in layouts/pocket.json layouts/pocket.svg themes/pocket.json themes/pocket-light.json; do
    aside "$dest/$f"
    ln -s "$here/$f" "$dest/$f"
  done
else
  [ -L "$dest/mods/pocket" ] && rm "$dest/mods/pocket"
  if command -v rsync >/dev/null; then
    rsync -a --exclude '__pycache__' "$here/mods/pocket/" "$dest/mods/pocket/"
  else
    mkdir -p "$dest/mods/pocket" && cp -R "$here/mods/pocket/." "$dest/mods/pocket/"
  fi
  for f in layouts/pocket.json layouts/pocket.svg themes/pocket.json themes/pocket-light.json; do
    [ -L "$dest/$f" ] && rm "$dest/$f"
    cp "$here/$f" "$dest/$f"
  done
fi
[ -n "$backup" ] && echo "pocket: the old copied install was moved to $backup"

# Herdr doesn't see a change behind a link, so with links a small watcher
# (tools/watch.py) swaps the link when a repo file changes, and Herdr reloads.
# A systemd user service where there is one; else run it yourself.
if [ "$mode" = link ]; then
  unit_dir=${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user
  if command -v systemctl >/dev/null && systemctl --user show-environment >/dev/null 2>&1; then
    mkdir -p "$unit_dir"
    cat > "$unit_dir/herdr-pocket-watch.service" <<EOF
[Unit]
Description=Pocket (Herdr layout): reload when the repo's files change

[Service]
Environment=HERDR_APP_HOME=$dest
ExecStart=$(command -v python3) $here/tools/watch.py
Restart=on-failure

[Install]
WantedBy=default.target
EOF
    systemctl --user daemon-reload
    systemctl --user enable --now herdr-pocket-watch.service >/dev/null 2>&1
    systemctl --user restart herdr-pocket-watch.service
    echo "pocket: watcher on (systemctl --user status herdr-pocket-watch)"
  else
    echo "pocket: no systemd user session: run 'python3 $here/tools/watch.py &' while editing"
  fi
elif [ -f "${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/herdr-pocket-watch.service" ]; then
  systemctl --user disable --now herdr-pocket-watch.service >/dev/null 2>&1 || true
fi

# Antigravity CLI helper: persistent tracking of Gemini & Other model quotas and session info.
if [ -d "$HOME/.gemini/antigravity-cli" ] && command -v jq >/dev/null 2>&1; then
  as="$HOME/.gemini/antigravity-cli/settings.json"
  [ -s "$as" ] || echo '{}' > "$as"
  cur=$(jq -r '.statusLine.command // ""' "$as" 2>/dev/null || true)
  case "$cur" in
    ""|*agy-statusline.sh*)
      jq --arg s "sh \"$dest/mods/pocket/agy-statusline.sh\"" --arg t "sh \"$dest/mods/pocket/agy-title.sh\"" \
        '.statusLine = {type: "command", command: $s, stack_with_default: true} | .title = {type: "command", command: $t}' \
        "$as" > "$as.tmp" && mv "$as.tmp" "$as" || rm -f "$as.tmp"
      echo "pocket: Antigravity statusLine/title helper installed"
      ;;
  esac
fi

if command -v herdr-app >/dev/null; then
  herdr-app check "$dest/mods/pocket"
  echo "pocket: installed ($mode). Switch to it: herdr-app do layout.switch --name pocket"
else
  echo "pocket: installed ($mode) in $dest (herdr-app not on PATH, check skipped)"
fi
