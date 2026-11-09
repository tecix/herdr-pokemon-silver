#!/usr/bin/env python3
# Pocket dev watcher: with ./install.sh's symlinks, Herdr runs this repo's
# files but doesn't see them change (it watches its own home, and a change
# behind a symlink happens elsewhere). So: poll the repo's files, and when one
# changes, swap the matching link in the app's home for a fresh one (same
# target). Herdr sees the link change and reloads the mod / layout / theme.
# Pictures and sounds are copied instead (to data/pocket/ui): Herdr loads none
# behind a symlink. Standard library only; installed as a systemd user service
# by install.sh.
#   python3 tools/watch.py [--once | --assets]
import os
import shutil
import sys
import time

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST = os.environ.get("HERDR_APP_HOME") or os.path.expanduser("~/.config/herdr-app")
# What each link points at (relative to the repo and the app home alike).
LINKS = ["mods/pocket", "layouts/pocket.json", "layouts/pocket.svg", "themes/pocket.json"]
SKIP_DIRS = {"__pycache__", ".git"}
# Files Herdr itself writes into the mod folder: they must not trigger a reload.
SKIP_FILES = {"gpui-kit.d.ts", "jsconfig.json"}
# Folders copied (not linked) into the app home's data/pocket/ui.
ASSETS = ["glyphs", "sprites", "sounds"]
UI = os.path.join(DEST, "data", "pocket", "ui")


def copy_assets():
    """Copy mods/pocket/<glyphs|sprites|sounds> to data/pocket/ui, changed files
    only, and draw the Poké Ball there (tools/make-pokeball.py) if it is missing."""
    n = 0
    for a in ASSETS:
        src = os.path.join(HERE, "mods", "pocket", a)
        for root, _dirs, files in os.walk(src):
            out = os.path.join(UI, a, os.path.relpath(root, src))
            os.makedirs(out, exist_ok=True)
            for f in files:
                s, d = os.path.join(root, f), os.path.join(out, f)
                st = os.stat(s)
                try:
                    dt = os.stat(d)
                    if dt.st_size == st.st_size and dt.st_mtime_ns >= st.st_mtime_ns:
                        continue
                except FileNotFoundError:
                    pass
                shutil.copy2(s, d)
                n += 1
    ball = os.path.join(UI, "pokeball.svg")
    if not os.path.exists(ball):
        import subprocess
        svg = subprocess.run([sys.executable, os.path.join(HERE, "tools", "make-pokeball.py")], capture_output=True, text=True, check=True).stdout
        with open(ball, "w") as f:
            f.write(svg)
        n += 1
    if n:
        print(f"pocket watch: copied {n} picture/sound file(s) to {UI}", flush=True)


def stamp(rel):
    path = os.path.join(HERE, rel)
    if os.path.isfile(path):
        st = os.stat(path)
        return {rel: (st.st_mtime_ns, st.st_size)}
    out = {}
    for root, dirs, files in os.walk(path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            if f in SKIP_FILES or f.endswith((".pyc", ".swp", "~")):
                continue
            p = os.path.join(root, f)
            try:
                st = os.stat(p)
            except OSError:
                continue
            out[p] = (st.st_mtime_ns, st.st_size)
    return out


def relink(rel):
    link = os.path.join(DEST, rel)
    if not os.path.islink(link):
        return  # a copied install (./install.sh --copy): leave it alone
    tmp = link + ".pocket-tmp"
    try:
        os.remove(tmp)
    except FileNotFoundError:
        pass
    os.symlink(os.path.join(HERE, rel), tmp)
    os.replace(tmp, link)
    print(f"pocket watch: reloaded {rel}", flush=True)


def main():
    if "--assets" in sys.argv:
        copy_assets()
        return
    copy_assets()
    if "--once" in sys.argv:
        for rel in LINKS:
            relink(rel)
        return
    seen = {rel: stamp(rel) for rel in LINKS}
    while True:
        time.sleep(0.5)
        for rel in LINKS:
            now = stamp(rel)
            if now != seen[rel]:
                seen[rel] = now
                # Let an editor or git finish writing the rest first.
                time.sleep(0.3)
                seen[rel] = stamp(rel)
                if rel == "mods/pocket":
                    copy_assets()
                relink(rel)


if __name__ == "__main__":
    main()
