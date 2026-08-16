# 2026-08-16 — The bug-report flood: the key first, then the limit

Shipped `478700c` and `3bf67be`, both deployed (run 31959608418, success). One migration, three
client files. CI `tsc` artifact empty. **5 AI triage calls consumed, none of them by a refusal.**

## Task 1 — what can be keyed on

### What `ReportBugButton.tsx:75` inserts

`project` · `title` · `description` · `url` · `tester_name` · `report_type` · `app_version` ·
`status` · `session_id` · `breadcrumbs` · `console_logs` · `device_info` — the last a jsonb of
`platform`, `osVersion`, `appVersion`, `otaUpdateId`, `source`, `reportedAtLocal`, plus
`getBuildIdentity()`'s `native_build` / `native_version` / `web_build`.

**Nothing in it identified a device.** Across all 250 rows, `device_info->>'device_id'` is present
in **0**. The keys that exist — `brand`, `model`, `os`, `screen`, `buildNumber` — describe a *kind*
of device, not one device. `metadata->>'device'` is worse: its seven distinct values across 243 rows
are `iPhone`, `Safari`, `Chrome`, `unknown`.

### `session_id` is not a substitute, and this is the finding that changed the fix

`session_id` is set on 242 of 250 rows, and those 242 rows carry **242 distinct sessions**. Not one
session ever shows a second report. That is not tester behaviour — it is
`components/BugReporter.tsx:203`:

```js
session_id: `caps-${Date.now().toString(36)}`,   // a FRESH id on every single report
```

So the session limit shipped last run — 20 per session per 24h — **can never accumulate on the
path that produced almost every row.** And `utils/crashUploader.ts` sends no session at all, so the
automatic crash path sat outside every limit. That path is where the 71-in-a-day peak came from.

A per-device limit keyed on the column as it stood would have counted `NULL = NULL` — every report
in one bucket, a global limit wearing a per-device label. Exactly the failure the brief named.

### The key was added — one line, three paths

`getDeviceId()` (`utils/leaderboard.ts:32`) is a persisted SecureStore id the rest of the app
already relies on. It is now sent as `device_info.device_id` from **all three** client insert paths:
`ReportBugButton.tsx` (tester button), `BugReporter.tsx` (dev FAB / shake), and
`crashUploader.ts` (automatic crash). `BugReporter`'s minted session was also replaced with the real
`getSessionId()`, keeping the minted value only as a fallback.

**It also makes triage possible for the first time** — until today a report could not be tied to a
device, so "what else did this device file, and what was it doing" had no answer.

Proven live: the report filed through the real UI carried `device_id` `0f2a-af50-71a8`, byte-equal
to the value in the app's own storage (`caps-device-id`), on web build `3bf67be`.

## Task 2 — the limit

### Sized from the 250 rows, distribution not peak

Device *model* is the closest historical proxy for a device. It lumps devices together, so every
figure below **over-states** what one device really did:

| bucket | max | p95 | avg |
|---|---|---|---|
| per device / 1 min | 2 | 2 | 1.22 |
| per device / 10 min | **4** | 2 | 1.45 |
| per device / 1 hour | 8 | 5 | 1.97 |
| per device / 24 h | **35** | 33 | 6.94 |
| global / 1 hour | 13 | 8 | — |
| global / 24 h | **71** | — | 13.16 |

The 71 is not a person. It is 2026-03-20, `tester_name` null on every row, from the automatic
crash path. All 250 rows predate June; only **3** were ever filed through a tester button.

### What was chosen

| bound | value | why |
|---|---|---|
| per device / 10 min | **12** | 3× the observed 10-min max, and above the observed *hourly* max of 8 — an entire hour of real reporting compressed into ten minutes still passes |
| per device / 24 h | **60** | 1.7× the observed daily max of 35, itself an over-estimate |
| per session / 24 h | 20 | unchanged; applies only when there is no device id |
| **global / 1 hour** | **100** | 7.7× the observed global hourly max, above the busiest day on record |

A short window carries the weight, because a flood is a burst: a stuck retry loop or a script fires
many per minute, and the daily bound alone would let 60 external calls through before noticing.

**The global backstop is labelled global because that is what it is.** It is the only thing that
bounds a caller who sends no key at all, or who rotates a fresh device id per call. The cost is
real and worth stating: one flooder can spend the hour's allowance and refuse everyone else until
the window rolls. At 100 an hour that takes deliberate effort, and the alternative is unbounded AI
triage, Telegram and GitHub calls.

**Enforcement point: the existing trigger, rewritten.** `bug_reports_rate_limit` (BEFORE INSERT)
already existed from last run — no third thing was added to the insert path, and the client needed
no change to be refused correctly.

Trusted server-side pipelines are exempt: an insert whose verified JWT claims `service_role`
(`whatsapp-bot-handler`, `crash-analyzer`) returns immediately. A client cannot forge that claim.

### The two triggers

| trigger | timing | what it does |
|---|---|---|
| `bug_reports_rate_limit` | **BEFORE** INSERT | `enforce_bug_report_rate_limit()` — this limit |
| `on_bug_report_inserted` | AFTER INSERT | `trigger_analyze_bug_report()` → `net.http_post` to `analyze-bug-report`, but **only** `IF NEW.status = 'open' AND NEW.ai_summary IS NULL` |

The BEFORE trigger raising `check_violation` aborts the statement, so the AFTER trigger never runs.
That was measured, not assumed — see below.

## Task 3 — behaviour

**Anon INSERT is still open.** The policy `Anyone can insert bug reports` (`WITH CHECK true`) is
untouched, and the live report below was filed with the anon key.

### Verified by exploiting, then by reporting normally

```
DEVICE BURST (anon, over HTTP)      calls 1-12 accepted, call 13 refused
  400 {"code":"23514","message":"bug_report_rate_limit: 12 reports from this device in 10 minutes (max 12)"}

DEVICE DAY (60 backdated + 1)       call 60 accepted, call 61 refused
  bug_report_rate_limit: 60 reports from this device in 24h (max 60)

KEY ROTATION (fresh device id each) 99 keyless rows in the hour, then 3 rotating ids:
  1 accepted (the 100th), 2 refused by the GLOBAL backstop — the per-device limit cannot see this

SESSION PATH (no device id)         unchanged, still accepted
```

### The external services were not called — measured

`net._http_response` runs at a steady **1 every 2 minutes** of unrelated background traffic. Against
that baseline:

```
control:  1 accepted report with status='open'      -> +1  (19:42, the AI POST, 200)
flood:    12 accepted muted rows + 2 refusals       -> +0
global:   99 muted rows + 2 refusals                -> +0
```

The delta of exactly **1** for the control is what makes the zeros mean something — a zero from a
broken pipeline would look identical. Refusals reach nothing.

**Cost this run: 5 triage calls**, every one from an *accepted* report with `status='open'`
(1 control + 4 live UI reports across two runs). Zero from any refusal, zero from 111 muted probe
rows. Last run's flood cost 21; the muted-row technique (`status` ≠ `'open'`) is why this one cost
what it did.

### A refusal must not look broken — and it did

The refusal fell into the existing generic error: **"Couldn't send — check your connection and try
again."** Wrong on both counts. Nothing is wrong with their connection, and retrying immediately
cannot work, so a tester is told to do the one thing that will keep failing. Fixed with a distinct
state; the typed text is kept so the same report can be sent once the window rolls.

Live, **both engines**, filed through the real Settings row at 390px:

```
NORMAL  chromium / webkit -> "✅ Thanks!" ; row landed with device_id + session + web_build
REFUSED chromium / webkit -> "Not sent — that's a lot of reports in a short time.
                              Wait a few minutes and send this again."
                              Send button still present, no false "Thanks"
```

## DB state

```
bug_reports 250 (baseline, verified by query) | probe rows 0
hand_history 151 | rooms 11 | room_players 0 | starter_pack_redemptions 0
_backup_starter_redemptions_20260816 649 — INTACT
```

`leaderboard` reads **792** against 782. Ten rows arrived between 18:39 and 19:53, none of them
carrying any of the four device ids my browsers used, all with the 2,530 welcome-bonus shape. They
are real visitors; deleting them would destroy real data to make a number match.

## MACHINE

`tsc` crashed twice in a row — a V8 fatal (exit 3) then `0xC0000005` — before returning 0 on the
third attempt, and 0 again after the second commit. CI's artifact is an empty file. Memory test
still not run, so local results stay PROVISIONAL.

=== STRATEGIST HANDOFF — BUG REPORT FLOOD ===
TASK 1 THE KEY:
  - what ReportBugButton.tsx:75 inserts: project, title, description, url, tester_name, report_type,
    app_version, status, session_id, breadcrumbs, console_logs, device_info{platform, osVersion,
    appVersion, otaUpdateId, source, reportedAtLocal, native_build, native_version, web_build}.
  - anything stable per device already present? NO. device_id in 0 of 250. The device_info keys are
    brand/model/os/screen/buildNumber — a KIND of device, not one. metadata->>'device' has seven
    distinct values across 243 rows (iPhone, Safari, Chrome, unknown).
  - session_id is NOT a fallback key, and this changed the fix: BugReporter.tsx:203 minted a FRESH
    session per report (`caps-<ts>`), so 242 session-bearing rows carry 242 DISTINCT sessions and no
    session ever shows a second report. Last run's 20/session/24h limit could never accumulate on
    the dominant path. crashUploader.ts sends NO session — the path that produced the 71/day peak.
  - device_id added to the payload? YES — one line, all THREE client paths (ReportBugButton,
    BugReporter, crashUploader), as device_info.device_id from getDeviceId() (utils/leaderboard.ts,
    persisted SecureStore). BugReporter's minted session also replaced with the real getSessionId().
    Triage: it is the first time a report can be tied to a device at all. PROVEN LIVE — the report
    filed through the real UI carried device_id 0f2a-af50-71a8, byte-equal to the app's own storage.
  - global limit instead? Not INSTEAD — see the backstop below, and it is labelled global.
TASK 2 THE LIMIT:
  - distribution (device-model proxy, which OVER-states one device): per device 1min max 2 |
    10min max 4, p95 2 | 1h max 8, p95 5 | 24h max 35, p95 33. Global: 1h max 13, p95 8; 24h max 71.
    The 71 is 2026-03-20, tester_name null on every row, the AUTOMATIC crash path — not a person.
    All 250 rows predate June; only 3 were ever filed through a tester button.
  - window/threshold: 12 per device per 10 MINUTES (3x the 10-min max, and above the HOURLY max of
    8 — an hour of real reporting compressed into ten minutes still passes) AND 60 per device per
    24h (1.7x the observed daily max). A short window carries the weight because a flood is a burst.
  - GLOBAL BACKSTOP 100/hour, labelled global because that is what it is: the only bound on a caller
    who sends no key, or rotates a fresh device id per call. Cost stated plainly — one flooder can
    spend the hour and refuse everyone until it rolls; the alternative is unbounded external calls.
  - per-session 20/24h kept UNCHANGED, and only for rows with no device id. Nulls are NOT bucketed.
  - enforcement point: the EXISTING BEFORE INSERT trigger, rewritten — no third thing on the insert
    path, no client change needed to be refused. service_role exempt via the verified JWT claim
    (whatsapp-bot-handler, crash-analyzer file on Roye's behalf); a client cannot forge it.
  - THE TWO TRIGGERS: bug_reports_rate_limit (BEFORE INSERT, this limit — added last run, so one of
    the two was mine) and on_bug_report_inserted (AFTER INSERT -> trigger_analyze_bug_report ->
    net.http_post to analyze-bug-report, and ONLY IF status='open' AND ai_summary IS NULL).
  - does a refused insert avoid firing them? YES, MEASURED. net._http_response runs at a steady
    1-per-2-minutes of background traffic; against that baseline the control (1 accepted, status
    open) gave +1 at 19:42 and the flood (12 accepted muted + 2 refusals) gave +0, as did the global
    test (99 muted + 2 refusals). The delta of exactly 1 is what makes the zeros mean something.
TASK 3 BEHAVIOUR:
  - anon INSERT still open? YES — policy "Anyone can insert bug reports" (WITH CHECK true)
    untouched, and the live report was filed with the anon key.
  - FLOOD: refused at CALL 13 —
    400 {"code":"23514","message":"bug_report_rate_limit: 12 reports from this device in 10 minutes (max 12)"}
    day cap: accepted at 60, refused at 61. Key rotation: 2 of 3 refused by the global backstop.
    EXTERNAL SERVICES NOT CALLED — evidence above. Cost this run 5 triage calls, ALL from accepted
    status='open' reports (1 control + 4 live UI), ZERO from any refusal and zero from 111 muted
    probe rows. Last run cost 21; muting probe rows via status != 'open' is why.
  - NORMAL report still lands? YES, both engines, through the real Settings row at 390px:
    "✅ Thanks!" and the row carries device_id, real session_id and web_build 3bf67be.
  - does a refusal look like a crash? IT DID, AND THAT IS FIXED. It fell into the generic
    "Couldn't send — check your connection and try again" — wrong on both counts, and it tells a
    tester to do the one thing that cannot work. Now: "Not sent — that's a lot of reports in a short
    time. Wait a few minutes and send this again." Send stays enabled, the typed text is kept, and
    no false "Thanks" appears. Verified on chromium AND webkit.
CLEANUP: bug_reports back to exactly 250, verified by query; probe rows 0; 0 rows in the last hour.
  hand_history 151, rooms 11, room_players 0, starter_pack_redemptions 0 (not re-deleted),
  _backup_starter_redemptions_20260816 649 (not dropped). No game_rooms/room_players rows deleted.
  leaderboard 792 vs 782: ten rows between 18:39 and 19:53, none carrying any of the four device ids
  my browsers used, all with the 2,530 welcome-bonus shape — real visitors, left alone.
MACHINE: tsc crashed TWICE consecutively (V8 fatal exit 3, then 0xC0000005) before returning 0 on
  the third attempt; 0 again after the second commit. Memory test still not run — local PROVISIONAL.
tsc: exit code 0 (by exit code, not output). CI artifact is an empty file.
HANDOFF: file + vamos_handoffs slug 2026-08-16-bug-report-flood | chars | code-point match? Y
WHAT I DID NOT CHECK: device_id is client-supplied and can be rotated exactly like session_id and
  p_hand_id, so only the global backstop bounds a determined flooder — no IP is stored, and nothing
  sturdier exists without a schema change; the native paths (BugReporter's shake/FAB and
  crashUploader) were changed but exercised only on web, since neither is reachable in a browser;
  the 60/24h device cap was proven with backdated rows rather than across a real 24 hours; I did not
  measure whether a genuine crash STORM on one device now loses reports it used to keep; and
  track_event and create_table remain unbounded and untouched.
=== END ===
