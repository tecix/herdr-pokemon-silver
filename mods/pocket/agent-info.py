#!/usr/bin/env python3
# Pocket: what Claude Code and Antigravity say about their own sessions, keyed
# by Herdr terminal:
#   Claude Code:
#     ~/.claude/sessions/<pid>.json   each running session: name, busy/idle, folder
#     /proc/<pid>/environ HC_TERMINAL_ID
#     `claude agents --json`          which sessions are blocked (cached 6 s)
#     the session's transcript        model and effort of the last request
#   Antigravity (agy):
#     /proc/<pid>/comm == "antigravity" + HC_TERMINAL_ID
#     ~/.gemini/antigravity-cli/presence/<cid>.lock
#     ~/.gemini/antigravity-cli/conversations/<cid>.db (gen_metadata)
#     ~/.gemini/antigravity-cli/conversation_summaries.db (title)
#     ~/.cache/{pocket,over9k}/agents/<term>.json (written by agy-statusline.sh)
# Prints {"<terminal>": {name, state, model, effort, kind, session}} (local only).
# Python 3, standard library; Linux (/proc).
import glob, json, os, re, sqlite3, subprocess, time

HOME = os.path.expanduser("~")
CACHE = os.path.join(HOME, ".cache", "pocket")
TAIL = 2 * 1024 * 1024


def alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except PermissionError:
        return True
    except (OSError, ValueError):
        return False


def env_of(pid, key):
    try:
        with open(f"/proc/{pid}/environ", "rb") as f:
            for kv in f.read().split(b"\0"):
                if kv.startswith(key.encode() + b"="):
                    return kv.split(b"=", 1)[1].decode("utf-8", "replace")
    except OSError:
        pass
    return None


def attach_clients():
    # Terminals showing a background session: `claude attach <id>` processes,
    # and active antigravity processes mapped to their HC_TERMINAL_ID.
    out = {}
    agy_pids = {}
    for d in glob.glob("/proc/[0-9]*"):
        pid_str = d[6:]
        try:
            pid = int(pid_str)
            with open(d + "/cmdline", "rb") as f:
                argv = f.read().split(b"\0")
        except (OSError, ValueError):
            continue
        if len(argv) >= 3 and argv[0].endswith(b"claude") and argv[1] == b"attach":
            term = env_of(pid, "HC_TERMINAL_ID")
            if term:
                out[argv[2].decode("utf-8", "replace")] = term
        else:
            try:
                with open(d + "/comm", "rb") as cf:
                    comm = cf.read().strip()
            except OSError:
                comm = b""
            a0 = argv[0] if argv else b""
            if comm in (b"agy", b"antigravity") or a0 in (b"agy", b"antigravity") or a0.endswith((b"/antigravity", b"/agy")):
                term = env_of(pid, "HC_TERMINAL_ID")
                if term:
                    agy_pids[pid] = term
    return out, agy_pids


def blocked_states():
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, "agents.json")
    try:
        if time.time() - os.path.getmtime(path) < 6:
            with open(path) as f:
                return json.load(f)
    except (OSError, ValueError):
        pass
    states = {}
    try:
        r = subprocess.run(["claude", "agents", "--json"], capture_output=True, text=True, timeout=8)
        for s in json.loads(r.stdout or "[]"):
            if s.get("sessionId"):
                states[s["sessionId"]] = s.get("state")
    except Exception:
        pass
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(states, f)
    os.replace(tmp, path)
    return states


def model_name(mid):
    if not mid:
        return None
    m = re.search(r"claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?![\d])", mid)
    if not m:
        return mid
    return f"{m.group(1).capitalize()} {m.group(2)}{'.' + m.group(3) if m.group(3) else ''}"


def model_of(session, cwd):
    path = None
    if cwd:
        p = os.path.join(HOME, ".claude", "projects", re.sub(r"[^A-Za-z0-9]", "-", cwd), f"{session}.jsonl")
        path = p if os.path.isfile(p) else None
    if not path:
        found = glob.glob(os.path.join(HOME, ".claude", "projects", "*", f"{session}.jsonl"))
        path = found[0] if found else None
    if not path:
        return None, None
    with open(path, "rb") as f:
        f.seek(0, 2)
        size = f.tell()
        f.seek(max(0, size - TAIL))
        lines = f.read().split(b"\n")
    reply = request = None
    for raw in reversed(lines):
        if reply and request:
            break
        if (reply is None and b'"type":"assistant"' in raw) or (request is None and b'"type":"api-request"' in raw):
            try:
                j = json.loads(raw)
            except Exception:
                continue
            if j.get("type") == "assistant" and reply is None and not j.get("isSidechain"):
                reply = j
            elif j.get("type") == "api-request" and request is None and j.get("querySource", "repl_main_thread") == "repl_main_thread":
                request = j
    params = (request or {}).get("params") or {}
    mid = params.get("model") or ((reply or {}).get("message") or {}).get("model")
    effort = (params.get("output_config") or {}).get("effort") or (params.get("effort") or {}).get("effort")
    return model_name(mid), effort if isinstance(effort, str) else None


def agy_clean_model(raw):
    if not raw or not isinstance(raw, str):
        return None
    s = re.sub(r"\s*\((Low|Medium|High|Xhigh|Max|Minimal)\)\s*$", "", raw.strip(), flags=re.I)
    if s.startswith("MODEL_"):
        parts = s[6:].split("_")
        if parts and parts[0] in ("GOOGLE", "ANTHROPIC", "OPENAI", "PLACEHOLDER"):
            parts = parts[1:]
        words = []
        i = 0
        while i < len(parts):
            p = parts[i]
            if p.isdigit() and i + 1 < len(parts) and parts[i + 1].isdigit():
                words.append(f"{p}.{parts[i + 1]}")
                i += 2
                continue
            words.append(p.upper() if p in ("GPT", "PRO", "MAX") else p.capitalize())
            i += 1
        return " ".join(words) if words else s
    return s or None


def collect_antigravity(agy_pids, out):
    agy_dir = os.path.join(HOME, ".gemini", "antigravity-cli")
    pid_to_cid = {}
    for pid in agy_pids:
        try:
            for fd in os.listdir(f"/proc/{pid}/fd"):
                try:
                    target = os.readlink(f"/proc/{pid}/fd/{fd}")
                except OSError:
                    continue
                if "/antigravity-cli/presence/" in target and target.endswith(".lock"):
                    pid_to_cid[pid] = os.path.basename(target)[:-5]
                    break
                if "/antigravity-cli/conversations/" in target and target.endswith(".db"):
                    pid_to_cid[pid] = os.path.basename(target)[:-3]
                    break
        except OSError:
            continue

    summaries_db = os.path.join(agy_dir, "conversation_summaries.db")
    for pid, term in agy_pids.items():
        if term in out:
            continue
        cached = None
        for cdir in (os.path.join(HOME, ".cache", "pocket", "agents"), os.path.join(HOME, ".cache", "over9k", "agents")):
            p = os.path.join(cdir, f"{term}.json")
            try:
                with open(p) as f:
                    d = json.load(f)
                if isinstance(d, dict) and d.get("agent") == "antigravity":
                    if not cached or (d.get("lastAt") or 0) >= (cached.get("lastAt") or 0):
                        cached = d
            except Exception:
                pass
        cid = pid_to_cid.get(pid) or (cached or {}).get("conversation")
        db_model = db_effort = db_title = None
        if cid:
            conv_db = os.path.join(agy_dir, "conversations", f"{cid}.db")
            if os.path.isfile(conv_db):
                try:
                    con = sqlite3.connect(f"file:{conv_db}?mode=ro", uri=True, timeout=1)
                    rows = dict(con.execute("SELECT key, value FROM gen_metadata WHERE key IN ('model', 'thinking_level')").fetchall())
                    con.close()
                    db_model = agy_clean_model(rows.get("model"))
                    tl = (rows.get("thinking_level") or "").strip().lower()
                    if tl and tl != "none":
                        db_effort = tl
                except Exception:
                    pass
            if os.path.isfile(summaries_db):
                try:
                    con = sqlite3.connect(f"file:{summaries_db}?mode=ro", uri=True, timeout=1)
                    row = con.execute("SELECT title FROM conversation_summaries WHERE conversation_id = ?", (cid,)).fetchone()
                    con.close()
                    if row and row[0] and row[0] != "Antigravity":
                        db_title = row[0]
                except Exception:
                    pass
        c_model = agy_clean_model((cached or {}).get("model"))
        c_effort = (cached or {}).get("effort")
        if isinstance(c_effort, str):
            c_effort = c_effort.strip().lower() or None
        c_title = (cached or {}).get("title")
        if c_title == "Antigravity":
            c_title = None
        model = c_model or db_model
        effort = c_effort or db_effort
        name = db_title or c_title
        if model or name or cid:
            out[term] = {
                "name": name,
                "state": None,
                "model": model,
                "effort": effort,
                "kind": "fg",
                "session": cid,
                "updatedAt": (cached or {}).get("lastAt"),
            }


def main():
    attached, agy_pids = attach_clients()
    sessions = []
    for f in glob.glob(os.path.join(HOME, ".claude", "sessions", "*.json")):
        try:
            with open(f) as fh:
                s = json.load(fh)
        except (OSError, ValueError):
            continue
        if isinstance(s.get("pid"), int) and alive(s["pid"]):
            sessions.append(s)
    states = blocked_states() if sessions else {}
    out = {}
    for s in sessions:
        sid = s.get("sessionId") or ""
        # A background session belongs to the terminal attached to it (its own
        # HC_TERMINAL_ID is just where it was started); a foreground one to its own.
        term = attached.get(s.get("jobId") or "") or attached.get(sid[:8])
        if not term and s.get("kind") != "bg":
            term = env_of(s["pid"], "HC_TERMINAL_ID")
        if not term:
            continue
        state = states.get(sid)
        if state not in ("working", "blocked", "idle"):
            state = "working" if s.get("status") == "busy" else "idle"
        # `claude agents` says "working" for a resting session it keeps alive;
        # the session file's busy/idle is the truth for those.
        if state == "working" and s.get("status") == "idle":
            state = "idle"
        model, effort = model_of(sid, s.get("cwd"))
        out[term] = {"name": s.get("name"), "state": state, "model": model, "effort": effort,
                     "kind": s.get("kind"), "session": sid, "updatedAt": s.get("statusUpdatedAt")}
    collect_antigravity(agy_pids, out)
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
