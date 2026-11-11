# Pocket HP: what each agent product has used of its usage limits on this
# machine. Run with `python3 -c` (on another machine through exec {on}), so it
# reads only standard files and prints one JSON line:
#   {"claude": {"used": 66, "resets_at": 1794245400, "at": 1794235207, "plan": "Max",
#               "windows": [{"id": "5h", "used": 66, "resets_at": ...},
#                           {"id": "7d", "used": 40, "resets_at": ...}]}, ...}
# used/resets_at = the 5-hour window (HP); windows = every window known (the
# agent info and stamina popups). used = percent used, resets_at/at = unix seconds.
# A product with nothing to read is left out.
#   claude      ~/.cache/{pocket,over9k}/usage/claude.json + ~/.claude.json plan
#   codex       recent ~/.codex/sessions/**/*.jsonl "rate_limits" (window 300/10080 min)
#   antigravity ~/.cache/{pocket,over9k}/usage/antigravity.json (Gemini & Other models)
#   opencode    ~/.cache/over9k/usage/opencode.json fallback (JS also runs opencode-quota.py)
import calendar, glob, json, os, re, time

home = os.path.expanduser("~")
cache_pocket = os.path.join(home, ".cache/pocket/usage")
cache_over9k = os.path.join(home, ".cache/over9k/usage")
out = {}


def load(path):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return None


def parse_iso(s):
    if not isinstance(s, str) or len(s) < 19:
        return None
    try:
        return int(calendar.timegm(time.strptime(s[:19], "%Y-%m-%dT%H:%M:%S")))
    except Exception:
        return None


def put(key, windows, at, plan=None):
    windows = [w for w in windows if w.get("used") is not None]
    if not windows:
        return
    entry = {"at": int(at) if at else int(time.time()), "windows": windows}
    if plan:
        entry["plan"] = str(plan)
    five = next((w for w in windows if w["id"] in ("5h", "5h:Gemini")), None)
    if five:
        entry["used"] = five["used"]
        entry["resets_at"] = five.get("resets_at")
    out[key] = entry


def minutes_id(m):
    return {300: "5h", 10080: "7d"}.get(m, f"{m}m" if m else "?")


# Claude Code
c_p = load(os.path.join(cache_pocket, "claude.json"))
c_o = load(os.path.join(cache_over9k, "claude.json"))
c = c_p if (c_p and (not c_o or (c_p.get("at") or 0) >= (c_o.get("at") or 0))) else c_o
if c:
    ws = []
    for name, wid in (("five_hour", "5h"), ("seven_day", "7d"), ("seven_day_opus", "7d:Opus"), ("seven_day_sonnet", "7d:Sonnet")):
        w = c.get(name) or (c_o or {}).get(name) or (c_p or {}).get(name)
        if isinstance(w, dict) and w.get("used_percentage") is not None:
            ws.append({"id": wid, "used": w.get("used_percentage"), "resets_at": w.get("resets_at")})
    c_cfg = load(os.path.join(home, ".claude.json")) or {}
    c_plan = ((c_cfg.get("oauthAccount") or {}).get("planDisplayName") or c.get("plan") or "").strip() or None
    put("claude", ws, c.get("at"), plan=c_plan)

# Codex: scan recent session files until we find a rate_limits entry with primary/secondary windows
files = sorted(glob.glob(os.path.join(home, ".codex/sessions/*/*/*/*.jsonl")), key=os.path.getmtime, reverse=True)
for cand in files[:12]:
    try:
        with open(cand, "rb") as f:
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
                    rl = x.get("rate_limits")
                    if isinstance(rl, dict) and (isinstance(rl.get("primary"), dict) or isinstance(rl.get("secondary"), dict)):
                        last = rl
                    stack.extend(x.values())
                elif isinstance(x, list):
                    stack.extend(x)
        if last:
            ws = []
            for w in (last.get("primary"), last.get("secondary")):
                if isinstance(w, dict):
                    ws.append({"id": minutes_id(w.get("window_minutes")), "used": w.get("used_percent"), "resets_at": w.get("resets_at")})
            put("codex", ws, int(os.path.getmtime(cand)), plan=last.get("plan_type"))
            break
    except Exception:
        pass

# Antigravity (Gemini models: gemini-5h, gemini-weekly; Other models: 3p-5h, 3p-weekly)
g_p = load(os.path.join(cache_pocket, "antigravity.json")) or {}
g_o = load(os.path.join(cache_over9k, "antigravity.json")) or {}
q_p = g_p.get("quota") if isinstance(g_p.get("quota"), dict) else {}
q_o = g_o.get("quota") if isinstance(g_o.get("quota"), dict) else {}
quota = dict(q_o)
for k, v in q_p.items():
    if not isinstance(v, dict):
        continue
    old = quota.get(k)
    if not isinstance(old, dict):
        quota[k] = v
        continue
    rt_new = parse_iso(v.get("reset_time")) or 0
    rt_old = parse_iso(old.get("reset_time")) or 0
    if rt_new - rt_old > 300:
        quota[k] = v
    elif rt_old - rt_new <= 300:
        rf_new = v.get("remaining_fraction", 1)
        rf_old = old.get("remaining_fraction", 1)
        if rf_new is not None and rf_old is not None and rf_old < rf_new:
            merged_b = dict(v)
            merged_b["remaining_fraction"] = rf_old
            quota[k] = merged_b
        else:
            quota[k] = v

if quota:
    at = max(g_p.get("at") or 0, g_o.get("at") or 0) or int(time.time())
    plan = g_p.get("plan") or g_o.get("plan")
    ws = []
    for bkey, wid in (
        ("gemini-weekly", "7d:Gemini"),
        ("gemini-5h", "5h:Gemini"),
        ("3p-weekly", "7d:Other"),
        ("3p-5h", "5h:Other"),
        ("gemini-argon-wtu-weekly", "7d:Argon"),
    ):
        q = quota.get(bkey)
        if not isinstance(q, dict):
            continue
        rf = q.get("remaining_fraction")
        if rf is None:
            continue
        rf = max(0.0, min(1.0, float(rf)))
        rs = q.get("reset_in_seconds")
        resets_at = parse_iso(q.get("reset_time"))
        if resets_at is None and rs is not None:
            resets_at = int(at + rs)
        ws.append({"id": wid, "used": round((1.0 - rf) * 100, 1), "resets_at": resets_at})
    put("antigravity", ws, at, plan=plan)

# OpenCode fallback from cached opencode.json (before opencode-quota.py runs)
oc = load(os.path.join(cache_pocket, "opencode.json")) or load(os.path.join(cache_over9k, "opencode.json"))
if isinstance(oc, dict):
    limits = []
    oc_at = oc.get("at")
    oc_plan = None
    entries = oc.get("entries")
    if isinstance(entries, dict):
        for ek, ev in entries.items():
            if not isinstance(ev, dict):
                continue
            q = ev.get("quota")
            if isinstance(q, dict):
                if q.get("at") and (not oc_at or q.get("at") > oc_at):
                    oc_at = q.get("at")
                for lk in ("go", "limits"):
                    if isinstance(q.get(lk), list):
                        limits.extend(q.get(lk))
                if ek == "go" and not oc_plan:
                    oc_plan = "Go"
    oc_data = oc.get("data") if isinstance(oc.get("data"), dict) else oc
    for sec in ("go", "current"):
        s = oc_data.get(sec)
        if isinstance(s, dict):
            if isinstance(s.get("limits"), list):
                limits.extend(s.get("limits"))
            if s.get("plan") and not oc_plan:
                oc_plan = s.get("plan")
    ws = []
    for x in limits:
        if not isinstance(x, dict) or x.get("used") is None:
            continue
        lbl = str(x.get("label") or "").strip().lower()
        wid = "5h" if lbl.startswith(("5h", "5-h", "5 h", "five")) else "7d" if lbl.startswith(("7d", "7-d", "week", "seven")) else "month" if lbl.startswith("month") else lbl
        if not wid:
            continue
        existing = next((w for w in ws if w["id"] == wid), None)
        if not existing:
            ws.append({"id": wid, "used": x.get("used"), "resets_at": int(x["resets_at"]) if x.get("resets_at") else None})
        elif float(x.get("used") or 0) > float(existing.get("used") or 0):
            existing["used"] = x.get("used")
    if ws:
        put("opencode", ws, oc_at or int(time.time()), plan=oc_plan)

print(json.dumps(out))
