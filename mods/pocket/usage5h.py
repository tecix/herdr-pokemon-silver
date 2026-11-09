# Pocket HP: what each agent product has used of its 5-hour limit on this
# machine. Run with `python3 -c` (on another machine through exec {on}), so it
# reads only standard files and prints one JSON line:
#   {"claude": {"used": 66, "resets_at": 1794245400, "at": 1794235207}, ...}
# used = percent used, resets_at/at = unix seconds. A product with nothing to
# read is left out. OpenCode is read by the JS side (over9k-usage's
# opencode-quota.py), not here.
#   claude      ~/.cache/over9k/usage/claude.json (Over9k's Claude status line)
#   codex       the newest ~/.codex/sessions/**/*.jsonl "rate_limits" (window 300 min)
#   antigravity ~/.cache/over9k/usage/antigravity.json "gemini-5h"
import glob, json, os, re, time

home = os.path.expanduser("~")
cache = os.path.join(home, ".cache/over9k/usage")
out = {}


def load(path):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return None


c = load(os.path.join(cache, "claude.json"))
if c and c.get("five_hour"):
    fh = c["five_hour"]
    out["claude"] = {"used": fh.get("used_percentage"), "resets_at": fh.get("resets_at"), "at": c.get("at")}

files = glob.glob(os.path.join(home, ".codex/sessions/*/*/*/*.jsonl"))
if files:
    newest = max(files, key=os.path.getmtime)
    try:
        with open(newest, "rb") as f:
            f.seek(0, 2)
            f.seek(max(0, f.tell() - 400000))
            tail = f.read().decode("utf-8", "replace")
        last = None
        for line in tail.splitlines():
            if '"rate_limits"' not in line:
                continue
            try:
                obj = json.loads(line)
            except Exception:
                continue
            stack = [obj]
            while stack:
                x = stack.pop()
                if isinstance(x, dict):
                    if isinstance(x.get("rate_limits"), dict):
                        last = x["rate_limits"]
                    stack.extend(x.values())
                elif isinstance(x, list):
                    stack.extend(x)
        if last:
            for w in (last.get("primary"), last.get("secondary")):
                if isinstance(w, dict) and w.get("window_minutes") == 300:
                    out["codex"] = {"used": w.get("used_percent"), "resets_at": w.get("resets_at"), "at": int(os.path.getmtime(newest))}
    except Exception:
        pass

g = load(os.path.join(cache, "antigravity.json"))
q = (g or {}).get("quota", {}).get("gemini-5h")
if q:
    at = g.get("at") or time.time()
    rs = q.get("reset_in_seconds")
    out["antigravity"] = {"used": (1 - (q.get("remaining_fraction") or 0)) * 100, "resets_at": at + rs if rs is not None else None, "at": at}

print(json.dumps(out))
