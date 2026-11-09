# Pocket HP: what each agent product has used of its usage limits on this
# machine. Run with `python3 -c` (on another machine through exec {on}), so it
# reads only standard files and prints one JSON line:
#   {"claude": {"used": 66, "resets_at": 1794245400, "at": 1794235207,
#               "windows": [{"id": "5h", "used": 66, "resets_at": ...},
#                           {"id": "7d", "used": 40, "resets_at": ...}]}, ...}
# used/resets_at = the 5-hour window (HP); windows = every window known (the
# agent info popup). used = percent used, resets_at/at = unix seconds. A
# product with nothing to read is left out. OpenCode is read by the JS side (over9k-usage's
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


def put(key, windows, at):
    windows = [w for w in windows if w.get("used") is not None]
    if not windows:
        return
    entry = {"at": at, "windows": windows}
    five = next((w for w in windows if w["id"] == "5h"), None)
    if five:
        entry["used"] = five["used"]
        entry["resets_at"] = five.get("resets_at")
    out[key] = entry


def minutes_id(m):
    return {300: "5h", 10080: "7d"}.get(m, f"{m}m" if m else "?")


c = load(os.path.join(cache, "claude.json"))
if c:
    ws = []
    for name, wid in (("five_hour", "5h"), ("seven_day", "7d"), ("seven_day_opus", "7d:Opus"), ("seven_day_sonnet", "7d:Sonnet")):
        w = c.get(name)
        if isinstance(w, dict):
            ws.append({"id": wid, "used": w.get("used_percentage"), "resets_at": w.get("resets_at")})
    put("claude", ws, c.get("at"))

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
            ws = []
            for w in (last.get("primary"), last.get("secondary")):
                if isinstance(w, dict):
                    ws.append({"id": minutes_id(w.get("window_minutes")), "used": w.get("used_percent"), "resets_at": w.get("resets_at")})
            put("codex", ws, int(os.path.getmtime(newest)))
    except Exception:
        pass

g = load(os.path.join(cache, "antigravity.json"))
quota = (g or {}).get("quota") or {}
if isinstance(quota, dict) and quota:
    at = g.get("at") or time.time()
    ws = []
    for name, q in quota.items():
        if not isinstance(q, dict):
            continue
        rs = q.get("reset_in_seconds")
        # "gemini-5h" -> "5h"; other models keep their name: "claude-5h" -> "5h:claude".
        m = re.match(r"^(.*?)-?(\d+[hdm]|weekly|daily|monthly)$", name)
        wid = name
        if m:
            span = {"weekly": "7d", "daily": "1d", "monthly": "month"}.get(m.group(2), m.group(2))
            wid = span if m.group(1) in ("", "gemini") else f"{span}:{m.group(1)}"
        ws.append({"id": wid, "used": (1 - (q.get("remaining_fraction") or 0)) * 100, "resets_at": at + rs if rs is not None else None})
    put("antigravity", ws, at)

print(json.dumps(out))
