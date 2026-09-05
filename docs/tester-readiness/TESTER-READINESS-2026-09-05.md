# VAMOS CAPS TESTER-READINESS — 2026-09-05

Repo @ `claude/vamos-caps-align-celebration-flppo0` · Supabase `gxrpunvhjcrzqnitbqah`.
Nothing was built, nobody was invited, production is unchanged.

---

## MAP — carried forward, unchanged

> "I presented 0 multiplayer hands and no bug reports since May as findings. They are not.
> Almost nobody has been invited. That is absence of users, not absence of function — the
> fourth time in this series I have read missing data as evidence, and Roye caught it each time."

Baseline at the start of this sprint: 513 devices · 25 have ever played · 0 finished rooms ·
250 bug reports, last 2026-05-26 · 772 events / 36 devices in 7 days · ledger gap 0.

**One line of that baseline is now measurably wrong, and it is mine.** "0 multiplayer hands" is
a measurement artefact of looking at `game_rooms`. `analytics_events` holds **55 `mp_game_ended`
rows across 47 devices** — real multiplayer hands, resolved on real screens, most recently
2026-08-20, carrying 30 distinct room codes.

`game_rooms` shows nothing because **it is reaped.** 54 distinct room codes have started a
multiplayer table and **none of the 54 is in `game_rooms` today**; a `cleanup_expired_rooms()`
function deletes from that table, and `finish_table()` marks a room `finished` and clears its
roster. `game_rooms` is a live-lobby working set, not a history. Reading "0 finished rooms" off
it and calling it "0 multiplayer hands" was my error, and `analytics_events` is where the
history actually lives.

So multiplayer HAS been exercised, by 47 devices, on 30 rooms that resolved a hand. Correcting my
own line, not Roye's.

---

## §1 · THE FEEDBACK PIPELINE

### The bug was filed the way a tester would file it

Driven through the built UI, not inserted: `tests/tester-report-loop.mjs` opens `/settings`,
finds the entry, opens the form, types, presses Send, and reads the screen.

| step | result |
|---|---|
| entry found in Settings | yes — `🐛 Report a bug`, 1091px down a 852px viewport (**1.3 screens of scrolling**) |
| form opens | yes — name, description, current screen, Cancel / Send |
| POST to `/rest/v1/bug_reports` fires | yes |
| row lands in the table | yes — HTTP **201**, verified separately from the shell |
| row carries context the tester never typed | yes — 4 breadcrumbs, 3 console lines, `device_id`, `session_id`, build id, platform, language |
| trigger `on_bug_report_inserted` fires | yes — `analyze-bug-report` returned `200 {"ok":true}` |
| Telegram message sent | yes — `whatsapp_sessions` row created, status `bug_pending` |
| **AI triage writes a summary** | **NO — `ai_summary`, `ai_severity`, `ai_screen` all NULL** |
| **report appears on the dashboard** | **NO — counted in `total_bugs`, excluded from `top_ux_issues`** |
| GitHub issue opened | **NO — `github_issue_url` is NULL in all 250 reports ever written** |

Screenshots: `docs/tester-readiness/report-form.png`, `report-after-send.png`.

### Where it breaks, precisely

`supabase/functions/analyze-bug-report/index.ts` calls Anthropic and then does:

```ts
const raw = (d.content?.[0]?.text ?? '{}').replace(/```json?\n?/g,'').replace(/```/g,'').trim();
try { return JSON.parse(raw); } catch { return { summary: description ?? 'Bug', … }; }
```

When the API returns an error body there is no `content`, so `raw` becomes `'{}'`, which parses
cleanly — the catch never runs and every field comes back `undefined`. The row is then updated to
`status: 'analyzed'` with NULL summary and severity, `classification` falling back to
`'UX_FEEDBACK'`. **A failed triage is indistinguishable from a successful one.**

It is not a missing key. If `ANTHROPIC_API_KEY` were absent the `!ANTHROPIC` branch would have
written `summary: description` — a non-null summary. It wrote NULL, so the key is set and the
call itself is failing (auth, quota, or model access).

**When it broke, to the minute.** `whatsapp_sessions.raw_input` carries the triage summary.
Last non-null: **2026-08-16 19:56:40 +03**. Every row since is NULL. The break is between
2026-08-16 and today, and today's two reports are the first that would have exposed it.

### The dashboard consequence

`get_bug_triage()` builds `top_ux_issues` from
`WHERE ai_summary IS NOT NULL AND ai_summary NOT LIKE '%undefined%'`. With AI triage dead, every
new report satisfies neither clause. The report is counted and invisible. That
`NOT LIKE '%undefined%'` filter is itself the fossil of a previous round of this same failure.

### What a tester SEES on submit

Watched, both ways, in the built app:

- **Success** — the form is replaced by `✅ Thanks!` / *Your report was sent to the team.* / `Done`.
  Clear, in the tester's language, and unambiguous. This half is fine.
- **Failure** — `Couldn't send — check your connection and try again.`, form stays open with the
  typed text intact so it can be retried. Also correct.

One real gap: **there is no timeout and no interim feedback.** Between pressing Send and the
network giving up, the tester sees only a spinner on the Send button. In this container the
browser took somewhere between 9 and 25 seconds to surface the error. On a phone with a weak
signal that is a long silence, and the brief's warning applies exactly: a tester who is unsure
whether it sent will not send the second one.

> Method note: the container's agent proxy resets every tunnel to `supabase.co`, so the real
> insert cannot complete from inside this browser (shell `curl` to the same endpoint returns 201).
> The failure state above is therefore the genuinely-observed one; the success state was observed
> by fulfilling that one POST with the 201 production really returns. Both were watched rendering.

### Debug capture — the overlay, the recorder, the shutdown detector

Roye's question was whether they still attach anything useful. **For a tester, none of them
attach anything, and the table proves it.**

| capture | reachable by a tester? | last time it attached anything |
|---|---|---|
| `DebugOverlay` | no — `app/_layout.tsx:682` renders it behind `debugEnabled`, and `debugLog` is `__DEV__`-gated | n/a (its log buffer *is* attached to reports) |
| Screen recorder (`utils/screenRecorder.ts`) | no — reached only from `BugReporter`, whose FAB is `__DEV__`-only (`:654`) and whose shake trigger is native-only (`:646`); the recorder itself returns false on web | **2026-04** — 12 video / 12 audio / 12 screenshot on bug reports; **0 since May** |
| Dirty-shutdown detector (`utils/crash-evidence.ts:175`) | never on web — `if (Platform.OS === 'web' …) return` | **2026-07** (2 rows). 0 in August, 0 in September |
| Crash screenshots on `crash_reports` | native only | **2026-03** (12 rows). 0 since |

What *is* alive is `utils/webErrorReporter.ts`, and it is alive in the wrong way: **100 of the
100 crash rows written in August, and the 1 in September, are web `Unhandled rejection` noise.**
The newest is `The play() request was interrupted by a call to pause()` — a benign audio-autoplay
rejection that the file's own `isBenign()` list does not match (it covers `play() failed` and
`didn't interact`, not `interrupted by a call to pause()`). And **`device_id` is NULL on all 350
crash rows ever written**, so no crash can be tied to the player who hit it.

### What a non-technical tester must actually do

From anywhere in the app: **Profile tab → Settings → scroll ~1.3 screens → 🐛 Report a bug →
type → Send.** Four taps, one scroll, and typing.

Honest assessment: **the form is easy; finding it is not.** Once open it asks two plain questions
and sends in one tap — a non-technical person will manage that without help. But nothing in the
app ever mentions it, it lives under a "TOOLS" heading below Delete Account, and it is the only
entry that exists on web. A tester who is not *told where it is* will not find it, and one who
hits a bug mid-hand has to leave the hand to report it. Assume every report costs a deliberate
detour, and tell testers the path explicitly in the invite.

---

## §2 · WILL WE MEASURE THE RIGHT THING

### Day-2 return: **YES, derivable today**

Run now against the existing table, excluding harness devices, cohorts at least 2 days old:

| cohort (devices) | ever played a hand | came back on day 2 | of those, had played |
|---|---|---|---|
| 565 | 216 | 9 | 9 |

1.6% day-2 return. Every one of the 9 who returned had played a hand; nobody who only looked
came back. That is the whole question the round exists to answer, and the query answers it.
Definitions are in `docs/tester-readiness/round-metrics.sql`.

The measurement limit is identity, not events. On web a `device_id` is per-browser-profile
`localStorage`, so a tester who returns in a different browser, on a different device, or after
clearing site data is counted as a new arrival. Anonymous auth does not help: over the last month
only 13 distinct `user_id`s appear across 209 devices. **Day-2 return is a floor, not a point
estimate**, and the invite should ask testers to come back on the same phone, same browser.

### Event correctness — one live mislabel, of exactly the class named

**`mp_game_ended` records a multiplayer tie as a loss for everyone.** The property is
`won: myDelta > 0`; a tie makes `myDelta` 0, so every seat gets `won: false`. Room `JER9`,
2026-08-20, a 2-player 4-board hand: host and guest both `net_chips: 0`, both `won: false`.
**19 of the 55 `mp_game_ended` rows ever written are that shape.** Solo was fixed for this on
2026-08-23 — `app/results.tsx` sends `outcome: win|tie|loss` beside `won` — and multiplayer was
not. If the round exercises multiplayer, its win rate will be wrong and will look right.

Reported, not fixed: this sprint's edit scope is `docs/` and `tests/`.

Two more, checked and cleared, so nobody re-raises them:

- **`game_started` vs `hand_dealt` divergence is already closed.** July shows 209 devices dealt a
  hand against 17 with `game_started`; that was fixed on 2026-08-17 (`eb79ae1`) and September
  reads 17 / 17. Do not re-fix it.
- **`is_complete: false` on `mp_game_ended` is not a mislabel.** It is the COMPLETE-bonus flag
  (won every board), not "the hand finished".

One naming caveat to carry: `app_opened` fires from the Home screen's mount effect, so it means
"Home was shown", not "the app was launched". It is still the right marker for a session start —
just do not read it as installs.

### The round's numbers

| # | number | derivable? | how / why not |
|---|---|---|---|
| 1 | installs (arrivals) | **yes, with a caveat** | first `app_opened` per device. Over-counts: a cleared browser is a new arrival |
| 2 | first hand played | **yes** | distinct devices with `hand_dealt`. Use this, not `hand_completed` — that only fires on `/results`, and 285 devices were dealt a hand against 88 that ever completed one |
| 3 | hands per player | **yes** | count `hand_dealt` per device. Report the **median** — all-time mean 2.9, median 2, max 198 |
| 4 | day-2 return | **yes** | the query above. Floor, not point estimate |
| 5 | ever reached multiplayer | **yes, in four steps** | 135 opened the lobby → 86 joined a table → 92 saw a table start → **47 finished a multiplayer hand**. Only the last one means "played against a human" |
| — | multiplayer win / loss / tie | **NO** | `mp_game_ended` has no `outcome`; ties are recorded as losses |
| — | a return on another device | **NO** | new `device_id`, counted as a new arrival |
| — | why someone left | **NO** | `stuck_dwell`, `rage_tap`, `screen_abandon` fire, but they say where to go and look, not why |

Filter every one of these on `v_automation_devices` **and** `properties->>'webdriver' <> 'true'`.
The webdriver flag is real and populated — 339 of the 2158 tagged events since 2026-08-01 are
automation, most of it this series' own probes. Without the filter the round measures us.

No dashboard was built.

---

## §3 · THE ROUND

### The structural risk, stated first

Multiplayer is the strongest retention lever modelled, it needs two humans awake at once, and
**it cannot be tested by people arriving one at a time.** A trickle of testers each plays bots,
each says it is fine, and the engine that matters is never touched. Every choice below exists to
prevent that.

### Shape: 4 testers, one 60-minute window, staged

**Stage 1 — four people, one coordinated hour.** Four is not a compromise, it is the table
maximum, and it is the only size that reaches every board count the game has: 4 players = 2
boards, 3 = 3, 2 = 4. Four people in one window can play all three in an hour. Put them on a group
chat for the duration so they can say "I'm in, code ABCD" out loud — the lobby has never had two
strangers in it at the same time, and it should not have to prove itself and coordinate strangers
on the same day.

Suggested hour: 20:00–21:00 local, a weekday. Send the link at 19:55, not before.

**Stage 2 — only if stage 1 ends with no stop condition hit.** Eight to twelve people, two
windows on different days, at least one of them without a group chat, to see whether the lobby
alone can put two people at a table.

**Staged, not all at once.** The round is not repeatable and first impressions happen once. If
the first hour surfaces something that spoils the experience, the remaining eight people have not
been spent yet. Cost of staging: a few days. Cost of not staging: the whole pool.

### Web, not TestFlight

- One link, no install, no Apple ID, no review queue. A coordinated hour survives a link; it does
  not survive twelve people each installing TestFlight at 20:00.
- Web is where the app already is, and where the invite friction is lowest for a group that is
  not technical.
- The honest cost: the native capture (screen recording, shake-to-report, dirty-shutdown) does
  not exist on web. Per §1 that costs nothing real — none of it has attached anything since
  April, and on a TestFlight *release* build the rich reporter is `__DEV__`-gated anyway. Choosing
  TestFlight would buy a capture pipeline that is already dark.
- Keep iOS for a later round, when there is something the web round proved worth re-checking on a
  real device.

### What we ask them — plain language, three lines

Not a QA script. They are players.

> Play for about half an hour. Try a game on your own first, then play against the others — hit
> **Play Online** and share the table code in the chat.
> When you're done, tell me three things:
> **1.** What did you not understand?
> **2.** When did you nearly stop playing?
> **3.** Would you open it again tomorrow — honestly?

And one operational line, because §1 says they will not find it otherwise:

> If something breaks: **Profile → Settings → scroll down → 🐛 Report a bug.** It's the fastest
> way to get it to me with the details attached.

### What we watch while they play

Live, from SQL, nothing new to build:

1. `analytics_events` — arrivals, `hand_dealt`, `mp_game_ended`. Is anyone reaching multiplayer?
2. `bug_reports` — do reports arrive at all, and do they carry breadcrumbs?
3. `crash_reports` — filtered to rows that are **not** `Unhandled rejection`, since those are noise.
4. `chip_transactions` vs `leaderboard.total_chips` — the ledger gap. Re-measured today across
   every device on the leaderboard: **0 devices disagree**. It must still be 0 the next morning.

Then, the next morning: the day-2 query. That is the number the round is for.

### What makes us stop and fix before inviting anyone else

Named in advance, so it is not argued about at 20:30:

1. **Two or more testers cannot get into a table together.** This is the round's whole purpose. Stop.
2. **A tester's balance goes wrong** — chips lost that were not staked, or a ledger gap above 0. Stop.
3. **A hand fails to resolve, or resolves differently on two screens.** Stop.
4. **A bug report is submitted and no row appears in `bug_reports`.** Stop: the round is now blind.
5. **Two or more testers hit the same crash on the same screen.** Stop; that one will hit everyone.
6. **The app opens in the wrong language, or a screen shows Hebrew to an English player.** Stop —
   that is the FULL-I18N zero-tolerance rule and it is cheap to hit.

Not stop conditions: cosmetic complaints, one person's confusion, a benign audio rejection in
`crash_reports`, a lone crash on one device.

### Before the invite goes out — two things worth an hour

Neither was done here (edit scope was `docs/` and `tests/`), and both are cheap:

1. **Get AI triage answering again**, or the round's reports pile up invisible. If the credential
   cannot be fixed in time, the fallback is smaller than the fix: make `triageWithAI` treat a
   response with no `content` as a failure so the existing non-AI fallback writes the tester's own
   words into `ai_summary`. Then a report is at least legible on the dashboard.
2. **Add `outcome` to `mp_game_ended`**, mirroring what `results.tsx` already sends. Without it
   every multiplayer tie in the round is recorded as a mutual loss.

---

## Housekeeping

- Test rows created during this sprint were deleted from production: 2 `bug_reports`
  (1576, 1577), 2 `whatsapp_sessions`. `bug_reports` is back to **250**, its pre-sprint count.
  0 rows remain from the probe device in `analytics_events`, `leaderboard` or `crash_reports`.
- Production unchanged: no economy change, no flag change, no security change, no art change,
  no nav change. No merge, no version bump.
- Nobody was invited. No dashboard, analytics feature or feedback form was built.
- Added: `tests/tester-report-loop.mjs`, `docs/tester-readiness/round-metrics.sql`, this
  document, and two screenshots.
