#!/usr/bin/env python3
# Pocket: what Claude Code says about its own sessions, keyed by Herdr terminal,
# for the agents Herdr can't see a status for (background sessions shown with
# `claude attach`, or a session that missed the OSC 7501 probe).
#   ~/.claude/sessions/<pid>.json   each running session: name, busy/idle, folder
#   /proc/<pid>/environ HC_TERMINAL_ID   which terminal it belongs to (a background
#                                   session keeps the one it was started from; an
#                                   attach client carries its own)
#   `claude agents --json`          which sessions are blocked (asked at most every
#                                   6 s, cached in ~/.cache/pocket/agents.json)
#   the session's transcript        model and effort of the last request
# Prints {"<terminal>": {name, state, model, effort, kind, session}} (local only).
# Python 3, standard library; Linux (/proc).
import glob, json, os, re, subprocess, time

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
                    return kv.split(b"=", 1)[1].decode()
    except OSError:
        pass
    return None


def attach_clients():
    # Terminals showing a background session: `claude attach <id>` processes.
    out = {}
    for d in glob.glob("/proc/[0-9]*"):
        try:
            with open(d + "/cmdline", "rb") as f:
                argv = f.read().split(b"\0")
        except OSError:
            continue
        if len(argv) >= 3 and argv[0].endswith(b"claude") and argv[1] == b"attach":
            term = env_of(int(d[6:]), "HC_TERMINAL_ID")
            if term:
                out[argv[2].decode()] = term
    return out


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


def main():
    attached = attach_clients()
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
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
