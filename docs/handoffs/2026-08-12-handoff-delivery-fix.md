# 2026-08-12 — Handoff delivery fix (re-send via Supabase)

Delivery only. No investigation, no app code.

## Task 1 — the lost handoff is now in Supabase

`docs/handoffs/2026-08-12-mp-full-hand-and-balance.md` inserted into `public.vamos_handoffs`
verbatim, dollar-quoted so markdown, backticks, pipes and emoji survived without escaping.

```
id 1 | slug 2026-08-12-mp-full-hand-and-balance | chars 6072 | 2026-08-12 14:04:35+03
```

**Verified verbatim, not merely "inserted".** The comparison needed care: PowerShell's `.Length`
counts UTF-16 units, so every emoji (`🪙 ✅ ❌ 💰`) counts twice, while Postgres `length()` counts
code points. Measured against the wrong one, a perfect copy looks 10 characters short. Code points
on both sides:

| | count |
|---|---|
| file on disk (`[...s].length`) | 6072 |
| `length(body)` in Postgres | 6072 |

Exact match, so nothing was truncated or re-escaped. For reference the file is 6179 bytes / 6082
UTF-16 units, LF endings, and contains no `$handoff$` sequence — dollar-quoting was safe.

## The tag that closed itself

This file's own first insert failed: `syntax error at or near "—"`. The body contains the literal
text `$handoff$` — in the sentence above saying it does not appear — so the quote terminated in the
middle of the document. Re-inserted under the tag `$HO2026$`.

The pre-flight check was supposed to catch that and reported `false`. It was wrong: the check ran as
`node -e "...s.includes('$handoff$')..."` inside a PowerShell **double-quoted** string, so PowerShell
expanded `$handoff` as an undefined variable before Node ever saw it, and the test degenerated into a
search for a string that was not there. Single-quote the `node -e` payload, or build the tag by
concatenation (`"$"+"handoff"+"$"`), so the shell cannot rewrite the thing being searched for.

Lesson, and it is the recurring one: a check that cannot fail is not a check. Confirm the guard
detects a known-present case before trusting a negative from it.

## Task 2 — protocol acknowledged

Every future run ends with all three, including runs that change nothing:

1. handoff printed in the reply
2. written to `docs/handoffs/YYYY-MM-DD-<slug>.md` and committed
3. inserted into `public.vamos_handoffs` under the same slug

The reply ends with the `HANDOFF: <path>` line.

## Constraints honoured

- No app code changed — this run touched only `docs/handoffs/` and the handoffs table.
- No RLS policies added to `vamos_handoffs`; `service_role`-only is left as-is.
- Nothing but handoffs written to that table.
- No `game_rooms` / `room_players` rows touched; no probe rows created, so none to delete.
  `bug_reports` remains 250.

=== STRATEGIST HANDOFF — DELIVERY FIX ===
TASK 1: inserted? slug 2026-08-12-mp-full-hand-and-balance | chars 6072 | matches the file's length? Y
TASK 2: protocol acknowledged — reply + file + table on every future run? Y
app code changed? NO
Verified by code points, not UTF-16 units — emoji count double in PowerShell and would fake a mismatch.
This handoff is itself in vamos_handoffs, under slug 2026-08-12-handoff-delivery-fix.
=== END ===
