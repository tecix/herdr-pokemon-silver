#!/bin/sh
# Antigravity CLI (agy) status line and persistent usage/session tracker for
# Pocket (and Over9k). Configured in ~/.gemini/antigravity-cli/settings.json
# under "statusLine" (stack_with_default: true).
#
# Tracks both Gemini models (gemini-5h, gemini-weekly) and Other models
# (3p-5h, 3p-weekly for Claude/GPT) persistently across sessions without
# dropping buckets when agy starts up or sends partial quota payloads.
in=$(cat)
title=$(printf '%s' "$in" | sh "$(dirname "$0")/agy-title.sh")
[ "$title" = Antigravity ] && title=""

# Print the status line under agy's default footer: context, current model
# group's 5h & weekly limits, then the other model group's limits.
printf '%s' "$in" | jq -r '
  def left: (. // 0) as $s | if $s <= 0 then "now"
    elif $s < 3600 then "\($s / 60 | floor)m"
    elif $s < 86400 then "\($s / 3600 | floor)h \($s % 3600 / 60 | floor)m"
    else "\($s / 86400 | floor)d \($s % 86400 / 3600 | floor)h" end;
  def color: (if . >= 80 then "31" elif . >= 50 then "33" else "32" end) as $c | "\u001b[\($c)m\(round)%\u001b[0m";
  def dim: "\u001b[2m\(.)\u001b[0m";
  def bucket($q; $k; $label): $q[$k] // empty
    | "\($label) \((1 - (.remaining_fraction // 1)) * 100 | color) " + ("· \(.reset_in_seconds | left)" | dim);
  def limits($q; $p): [bucket($q; "\($p)-weekly"; "week"), bucket($q; "\($p)-5h"; "5h")];
  (.quota // {}) as $q
  | (.model.display_name // "") as $dn
  | ($dn | test("^Gemini"; "i")) as $gem
  | (if $gem then ["gemini", "3p", "Claude & GPT"] else ["3p", "gemini", "Gemini"] end) as [$mine, $other, $otherName]
  | [ (.context_window.used_percentage // empty | "context \(color)"),
      limits($q; $mine)[],
      (limits($q; $other) | select(length > 0) | "\($otherName) " + join("   ")),
      bucket($q; "gemini-argon-wtu-weekly"; "Argon 4 week") ]
  | join("   ")' 2>/dev/null

# Save merged quota persistently to both ~/.cache/pocket/usage and ~/.cache/over9k/usage.
u_pocket="$HOME/.cache/pocket/usage"
u_over9k="$HOME/.cache/over9k/usage"
mkdir -p "$u_pocket" "$u_over9k"

saved=$(jq -c . "$u_pocket/antigravity.json" 2>/dev/null)
[ -n "$saved" ] || saved=$(jq -c . "$u_over9k/antigravity.json" 2>/dev/null)
[ -n "$saved" ] || saved={}

merged=$(printf '%s' "$in" | jq -ce --argjson saved "$saved" '
  def ts($s):
    if ($s | type) == "string" and ($s | length) >= 19 then
      (($s[:19] + "Z") | fromdateiso8601? // null)
    else null end;
  def merge_bucket($old; $new; $now):
    (if $new == null then $old
     elif $old == null then $new
     else
       (ts($old.reset_time)) as $ot
       | (ts($new.reset_time)) as $nt
       | if $ot != null and $nt != null then
           if ($nt - $ot) > 300 then $new
           elif ($ot - $nt) > 300 then $old
           else
             ($new | if ($old.remaining_fraction // 1) < (.remaining_fraction // 1) then .remaining_fraction = $old.remaining_fraction else . end)
           end
         elif ($new.reset_time // "") > ($old.reset_time // "") then $new
         elif ($new.reset_time // "") < ($old.reset_time // "") then $old
         elif ($old.remaining_fraction // 1) < ($new.remaining_fraction // 1) then ($new | .remaining_fraction = $old.remaining_fraction)
         else $new end
     end)
    | if . == null then null
      else
        (ts(.reset_time)) as $rt
        | if $rt != null then .reset_in_seconds = ([0, ($rt - $now)] | max) else . end
      end;
  (now | floor) as $now
  | ($saved.quota // {}) as $sq
  | (.quota // {}) as $nq
  | ([$sq | keys[], ($nq | keys[])] | unique) as $keys
  | (reduce $keys[] as $k ({};
      merge_bucket($sq[$k]; $nq[$k]; $now) as $v
      | if $v != null then .[$k] = $v else . end
    )) as $q
  | select(($q | length) > 0)
  | {
      at: $now,
      plan: (.plan_tier // $saved.plan // null),
      quota: $q
    }' 2>/dev/null)

if [ -n "$merged" ]; then
  for dir in "$u_pocket" "$u_over9k"; do
    printf '%s\n' "$merged" > "$dir/antigravity.json.tmp" 2>/dev/null && mv "$dir/antigravity.json.tmp" "$dir/antigravity.json" || rm -f "$dir/antigravity.json.tmp"
  done
fi

[ -n "${HC_TERMINAL_ID:-}" ] || exit 0
a_pocket="$HOME/.cache/pocket/agents"
a_over9k="$HOME/.cache/over9k/agents"
mkdir -p "$a_pocket" "$a_over9k"

prev=$(cat "$a_pocket/$HC_TERMINAL_ID.json" 2>/dev/null)
[ -n "$prev" ] || prev=$(cat "$a_over9k/$HC_TERMINAL_ID.json" 2>/dev/null)
[ -n "$prev" ] || prev={}

agent_json=$(printf '%s' "$in" | jq -c --argjson prev "$prev" --arg title "$title" '
  (.context_window.total_output_tokens // 0) as $out
  | (.model.display_name // .model.id // "" | sub(" *\\((Low|Medium|High|Xhigh|Max|Minimal)\\)$"; "")) as $m
  | {
      model: (if $m != "" then $m else $prev.model // "" end),
      id: (.model.id // $prev.id // null),
      effort: (.model.effort // $prev.effort // null),
      agent: "antigravity",
      context: (.context_window.used_percentage // $prev.context // null),
      out: $out,
      lastAt: (if $prev.lastAt != null and ($prev.out // 0) == $out then $prev.lastAt
               elif $out > 0 then (now | floor) else ($prev.lastAt // null) end),
      conversation: (if (.conversation_id // "") != "" then .conversation_id else $prev.conversation // null end),
      title: (if $title != "" then $title else $prev.title // null end)
    }' 2>/dev/null)

if [ -n "$agent_json" ]; then
  for dir in "$a_pocket" "$a_over9k"; do
    f="$dir/$HC_TERMINAL_ID.json"
    printf '%s\n' "$agent_json" > "$f.tmp" 2>/dev/null && mv "$f.tmp" "$f" || rm -f "$f.tmp"
  done
fi
