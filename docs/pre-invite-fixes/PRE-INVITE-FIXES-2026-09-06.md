# PRE-INVITE FIXES — 2026-09-06

Two fixes before anyone is invited, plus two small ones. All four are the same class of defect:
**something that would have made the round unreadable rather than broken.** We would have run the
round, got numbers, and the numbers would have been wrong and looked right.

Branch `claude/vamos-caps-align-celebration-flppo0`. `tsc --noEmit` clean. Full suite **2,731/2,731**.

---

## §1 — THE TRIAGE NOW FAILS LOUDLY

### The defect, stated exactly

`supabase/functions/analyze-bug-report/index.ts` read the model's answer as:

```ts
const raw = (d.content?.[0]?.text ?? '{}').replace(...);
try { return JSON.parse(raw); } catch { /* fallback */ }
```

Every error body the Messages API returns — 400, 401, 404, 429, 529 — and every network abort has
**no `content` array**. So `raw` became the two-character string `{}`, which parses PERFECTLY. The
`catch` holding the fallback never ran. `triage.summary` and all six siblings came back `undefined`,
the row was stamped `status: 'analyzed'`, and the tester's report was silently emptied while every
surface said it had been triaged.

`'{}'` parsing cleanly is the whole bug. Not the API, not the key.

### §1.3 — WHY THE CALL FAILS: IT DOESN'T. Establish, don't assume.

The brief's leading hypothesis (mine too) was the model id `claude-haiku-4-5-20251001`. **Wrong.**
Proven by running it, not by reading it:

| Report | Deployed build | Result |
|---|---|---|
| 1578 | fixed fn, real model id | `analyzed`, real AI summary, `triage_ai_error` NULL |
| 1579 | fixed fn, model id `caps-probe-invalid-model` | `triage_failed`, `http_404:not_found_error`, summary = tester's words |
| 1580 | fixed fn, real model id restored | `analyzed`, real AI summary, `triage_ai_error` NULL |

Report 1578's summary, written by the model against production today:

> "Reveal animation stutters for ~1 second after final card lands on three-board layout, and tally
> chip overlaps board title on narrow phone widths."

**The Anthropic call works.** The last row to carry a real AI summary before today was
2026-05-26, and it is a genuine model answer. There was never an ongoing API failure to fix.

### So what were the 204?

Not failures. **Never dispatched.** Distribution by month:

| Month | Rows | With a summary |
|---|---|---|
| 2026-03 | 232 | 32 |
| 2026-04 | 12 | 11 |
| 2026-05 | 6 | 3 |

232 of 250 are March 2026 — five months before the round. They now sit in statuses
(`dismissed` 207, `closed` 34) that the batch selector, which requires `status = 'open'`, can never
pick up. Zero rows are `open`. Nothing was retrying and nothing was failing; the queue was empty.

### §1.4 — THE CUTOFF, NOT A BACKFILL

Recorded in the database itself, as a column comment, so it survives this doc:

```
COMMENT ON COLUMN public.bug_reports.ai_summary IS
  '... CUTOFF: rows created BEFORE 2026-09-06 with ai_summary IS NULL (204 of the first 250) were
   never triaged and are NOT backfilled — the reports they describe are months old and their
   audio/screenshots have expired. Treat NULL before the cutoff as "never processed", not as
   "the AI had nothing to say".'
```

### §1.5 — `github_issue_url` IS RETIRED, NOT FIXED

It is NULL in all 250 rows because **nothing has ever written it**: zero writers in the repo, zero
in any database function (`pg_get_functiondef` scan over every `public` function returned an empty
set), zero in any Edge Function. It was never wired to GitHub. It is not surfaced by
`get_bug_triage` or `get_bug_tracker` either, so it looks like a feature only in the schema.

Retired by comment rather than dropped — dropping two columns from a production table to delete a
field nobody reads is a bigger change than the problem:

```
COMMENT ON COLUMN public.bug_reports.github_issue_url IS
  'DEAD FIELD, RETIRED 2026-09-06. ... do not read it, do not present it as a feature, and do not
   conclude from its NULLs that issue creation failed.';
```

Same for `github_issue_number`. **Building the GitHub integration is a separate decision and was
not made here.**

### What changed

- A missing `content` array, a non-2xx status, an unparseable body, a missing `summary` field and a
  network abort are each **named failures** now, recorded on `metadata.triage_ai_error`.
- A failed triage writes `status: 'triage_failed'` and `needs_review: true` — never `analyzed`.
- `ai_summary` is non-null either way. On failure it is **the tester's own words**. Proven on 1579:
  `description = ai_summary` returned true.
- The Anthropic call gained a 20s timeout. It had none.
- Telegram announces the failure instead of rendering a plausible empty card.
- `get_bug_tracker` counts `triage_failed` (its own bucket, and inside `open`) and now exposes
  `triage_ai_error`. Without this a failed row would exist, be readable, and appear in no total —
  the same "looks right, is wrong" shape as the bug being fixed.

### ⚠️ ONE THING I BROKE AND FIXED, ON THE RECORD

Redeploying the function through the management API **reset `verify_jwt` from false to true.** The
DB trigger posted with no `Authorization` header, so from that moment every insert would have
produced a 401 and no report would ever have been triaged — precisely the failure this sprint
exists to prevent, introduced by the fix for it.

Rather than turn `verify_jwt` back off, `trigger_analyze_bug_report()` now presents the project's
anon JWT (the key the app already ships with, public by design). The endpoint is no longer callable
without a project key, and the pipeline survives any future redeploy whatever `verify_jwt` resets
to. Verified end-to-end: `net._http_response` shows `200 {"ok":true}` for report 1578's trigger.

---

## §2 — THE MULTIPLAYER TIE

`mp_game_ended` recorded `won: myDelta > 0` — a statement about **chips**. A hand whose boards tie
records `won:false` for every seat, so in the event stream a tie is indistinguishable from a loss.
That is a **fifth** place deciding who won from chips, after the screen, the ladder, the record and
the local achievement check were all moved onto boards.

Both call sites — host (`app/multiplayer-game.tsx:773`) and guest (`:928`) — now emit:

```ts
const outcome = deriveHandOutcome(revealBoards);
```

**From BOARDS, not chips**, through the one derivation, over the same `revealBoards` the
celebration reads — so the analytics row and the screen cannot disagree. `won` is unchanged, for
compatibility with the 55 rows already recorded.

### §2.3 — CUTOFF, NOT A BACKFILL

Measured baseline: **55 `mp_game_ended` rows, 47 devices, 30 rooms, 0 carrying `outcome`, 20 with
`won:true`**, dated 2026-06-24 to 2026-08-20. They are not backfilled: the event never stored
per-board data, so those hands cannot be adjudicated at all — the same reason the solo tie backfill
was refused (`hand_history.boards_data` is NULL in 100% of production rows). From 2026-09-06 events
carry `outcome`; before it, `won:false` means "did not net positive chips", **not** "lost".

### §2.4 — A REAL TIE CANNOT BE FORCED HERE, AND HERE IS THE PROOF THAT IT CANNOT

`game_rooms` holds **9 rows, every one `status = 'waiting'`**. No room has ever reached `playing`,
let alone `finished`. Two connected clients completing a hand whose boards split evenly is not
reachable from this container — the same reason no multiplayer clip could be filmed last sprint.
Rather than stage something misleading, the branch is proven in
`utils/__tests__/mp-outcome-event.test.ts` on the exact board shapes the two sites construct:

- 3 players / 3 boards / one board each → **tie** (the collapsed `winner` count says loss: 1 vs 2).
- Heads-up 1–1 → tie. Boards that themselves tie → do not hand the hand to an opponent.
- 4 players, 2 boards to me and 1 each to two opponents → **win** against the best single opponent,
  though the opponents' combined count equals mine.
- Plus a source guard: exactly two `mp_game_ended` fires, both carrying `outcome`, both derived
  from `revealBoards` and never from `myDelta`, and `won` kept at both.

---

## §3 — TWO SMALL THINGS

### §3.1 — The bug form had no ceiling

`send()` awaited the insert with **no timeout and no interim feedback**. A tester watched a bare
spinner for however long the request took — 9 to 25 seconds before it failed on its own — with
nothing on screen distinguishing "working" from "stuck" from "already sent".

- `SEND_TIMEOUT_MS = 12000`, enforced with `.abortSignal()` so the request is genuinely cancelled
  and cannot resolve later over a state the tester has moved past.
- `SLOW_HINT_MS = 3000`: "Sending…" from the first moment, "Still sending — this is taking longer
  than usual." after three seconds.
- A timeout is its own outcome, not a generic connection error: *"Gave up after 12 seconds — your
  report wasn't sent. Your text is still here, tap Send to try again."* The text is preserved.
- Three new strings, both languages. New testIDs `report-bug-sending`, `report-bug-timeout`.
- Timers are cleared on unmount and in `finally`.

### §3.2 — Crash rows now name their device (small, so fixed)

`crash_reports.device_id` is NULL in **all 350 rows**. Split by writer:

| Source | Rows | With device_id | Last row |
|---|---|---|---|
| web (`utils/webErrorReporter`) | 191 | 0 | 2026-09-01 |
| ios | 158 | 0 | 2026-07-23 |
| other | 1 | 0 | 2026-03-24 |

The other two writers (`utils/crash-evidence`, `utils/notifications`) have set `device_id` since
AU2.1 (`80e1c91`, 2026-08-01) — but the last native crash row predates it, so **that fix has never
written a row.** `webErrorReporter` is the live web writer and simply never had the field. Web is
where the round happens.

Fixed: `getCachedDeviceId()` added to `utils/leaderboard.ts` (synchronous, returns null rather than
inventing an id), the cache warmed once at `initWebErrorReporter()`, and read in `report()` — which
must stay synchronous because it runs from a `window 'error'` handler.

**No backfill.** The device behind those 350 rows cannot be recovered from the row, and inventing
one would make a join look sound when it is a guess. Cutoff: web crash rows from 2026-09-06 carry it.

Also filtered one more non-actionable rejection, the newest live crash row:
`"The play() request was interrupted by a call to pause()"` — same class as the four autoplay
messages `isBenign()` already covered, and it fires on every navigation away from a screen with sound.

---

## WHAT I FOUND THAT WAS NOT ASKED FOR

1. **A live Telegram bot token was a literal in `supabase/functions/retriage-pending/index.ts`**
   and has been in git history since the file was committed. `analyze-bug-report` was de-hardcoded
   onto the vault on 2026-05-24; this copy was missed. Now reads the same vault RPC on disk.
   ⚠️ **The token is still exposed in history and should be rotated. That is Roye's call.**
2. **`retriage-pending` carried the identical `?? '{}'` defect** and would have re-corrupted rows if
   ever run. Fixed on disk. Two further bugs in it, also fixed on disk: it discarded the tester's
   TYPED description (passing only the audio transcription), and its retry selector filtered on
   `ai_summary IS NULL`, which a `triage_failed` row never satisfies — the retry path would have
   been dead on arrival.
3. **`retriage-pending` IS NOT DEPLOYED.** Deploying it would flip its `verify_jwt` from false to
   true, exactly as happened to `analyze-bug-report`, and it is a manually-invoked tool nobody is
   currently calling — no cron job references it. I did not want to change infra on a function
   outside the brief. Disk is ahead of cloud for this one file, deliberately. To ship it:
   deploy `supabase/functions/retriage-pending/index.ts` and send a project key when invoking it.

## THE THREE TEST ROWS

Reports **1578, 1579, 1580** (`tester_name = 'PRE-INVITE-TEST'`) are real rows in production and
are the evidence above. Left as they are — Roye decides. To clear them before the round:

```sql
UPDATE bug_reports SET status = 'dismissed'
 WHERE tester_name = 'PRE-INVITE-TEST';
```

## WHAT THIS DOES NOT COVER

- No real multiplayer tie was observed, because none can be — see §2.4.
- The AI triage is proven working today; it is not proven to stay working. `triage_failed` plus the
  Telegram warning is what tells you if it stops.
- Nothing was backfilled. Every pre-cutoff number in `bug_reports`, `analytics_events` and
  `crash_reports` still means what it always meant, which is less than it looks like.
- No one was invited. No payment flag was enabled. `verify_jwt` was not turned off anywhere.
