# CAPS deep audit — 2026-09-10

**Repo `royea-beep/caps-poker` at `ef55640` (origin/main) · Supabase `gxrpunvhjcrzqnitbqah` · handoffs at 209.** One long run: index everything, map everything, fix what is provably safe, report the rest. Every number in these files was measured today; the SQL and shell behind each is in `QUERIES.md`.

| file | what it is |
|---|---|
| `FINDINGS.md` | every finding, ranked by cost to the product, with status (fixed / patch / reported) and the SQL for the two security items |
| `SCREENS.md` | 33 routes: purpose, measured reachability, guards, flags |
| `DB-OBJECTS.md` | 73 tables (rows, last write, RLS, grants), 12 views (what anon can read, measured), 8 triggers, 31 cron jobs (7-day health), what the 198-functions / 73-tables ratio contains |
| `DB-FUNCTIONS.md` | all 198 functions with callers found (trigger / cron / client rpc / edge / other SQL / view / none) |
| `EDGE-FUNCTIONS.md` | 14 deployed vs 13 in the repo; deploy style; deployed-vs-repo diff |
| `ASSETS.md` | every shipped asset by sha256, the identical pairs, the look-alike pairs, which cover is live and how that was decided |
| `WORKFLOWS.md` | 19 registered workflows vs 17 files: trigger, state, last run, result |
| `BRANCHES.md` | 65 branches; the one that is ahead of production |
| `DOCS-INDEX.md` | every .md at the root and in docs/: CURRENT / STALE / HISTORICAL / UNAUDITED, with stale-claim counts and what was done |
| `root-docs.patch` | corrections and banners for 17 stale root files (outside this session's edit allowance); `git apply docs/deep-audit-2026-09-10/root-docs.patch` |
| `QUERIES.md` | the queries and commands behind every number |

## Ground truth, re-measured (all seven matched the brief)

| | brief | measured |
|---|---|---|
| devices (`leaderboard` rows) | 403 | **403** |
| have played (`games_played > 0`) | 25 | **25** (26 by `hands_played`, 10 by distinct `hand_history.device_id`) |
| hands (`hand_history`) | 78 | **78** |
| bindings (`device_identity`) | 14 | **14** |
| ledger gap (`sum(chips) − sum(amount)`) | 0 | **0** (812,400 = 812,400) |
| max chips | 3,250 | **3,250** |
| purchases | 0 | **0** (+ `chip_purchases` 0) |
| handoffs | 209 | max id **209**, 207 rows (19 and 172 missing) |

## PASS / FAIL / COULD NOT VERIFY

| area | result | evidence |
|---|---|---|
| Ground truth (7 numbers) | PASS | table above |
| Economy invariant today | PASS | float = ledger = 812,400 |
| Economy invariant has a control | **FAIL** | no function compares them (`health_check` sums, never subtracts) — FINDINGS #4 |
| `submit_score` faucet | PASS (closed 2026-09-08) | live `pg_get_functiondef`: stats-only, `chips_written:false` |
| Repo main = production | **FAIL** | 33 commits and one applied migration only on the celebration branch — FINDINGS #3 |
| Anon cannot read the ledger | **FAIL** for the archive | 4,237 rows via `SET ROLE anon` — FINDINGS #1 |
| Anon cannot list device ids | **FAIL** | 8 + 7 rows via two views — FINDINGS #2 |
| Cron health (31 jobs, 7 days) | PASS | 0 failures |
| Jest on main | PASS | 2,846 / 2,846, 53 suites, 253 s |
| Web deploy = head | PASS | `web-deploy.yml` on `ef55640`, live bundle hash read, 404s honest |
| Landing page carries the explainer | PASS | sha-pinned embed served (32,816 B) |
| Facebook cover = 851×315 file | PASS by record, COULD NOT VERIFY live | runbook §2 identifies it by content; no browser path to Facebook from here |
| Assets: two covers, one live | PASS | `ASSETS.md` — identified by content, not date |
| Sound files match their names | **FAIL** | `boardLose.wav` = `boardWin.wav` = `revealStart.wav` — FINDINGS #5 |
| Product map reachability | **FAIL → fixed** | 3 routes URL-only, 2 redirects misdescribed, 8 "reached by" wrong |
| Docs current-shaped | **FAIL** | 0 of 73 audited came back CURRENT; 32 STALE |
| Workflows: two ghosts on a deleted branch | PASS (known, inert) | GitHub refuses dispatch; cannot be removed via API |
| Edge functions: repo = deployed | **FAIL** for 2 of 14 | `whatsapp-bot-handler` and `crash-analyzer` run an Empire-HQ transport the repo never held; `resolve-hand` and 7 others byte-identical; `resolver-probe` deploy-only — `EDGE-FUNCTIONS.md` |
| TestFlight public link disabled | COULD NOT VERIFY | needs an ASC read (`testflight-manage.yml` dispatch); not dispatched from an audit |
| App Store listing blank | COULD NOT VERIFY today | last read 2026-09-08 (handoff 203), no reason to expect change |
| PITR / backups add-on | COULD NOT VERIFY | organization endpoint denies; WAL archiving was healthy on 2026-09-08 |

## NEVER VERIFIED — stated once

Native iOS rendering on a real device (every visual verdict in this project is a web export in headless Chromium, and the sound finding above has never been heard by anyone). The bug reporter's media path end to end. Two real clients in one room — `room_players` has 0 rows and no room has ever reached `playing` in the product's history, so every multiplayer verdict is code-read or single-client. Multiplayer under any load. This audit added nothing to that list and removed nothing from it: it had no device, no second client and no billing access either.

## Verdict

**Ready for testers?** Yes — for the single-player loop on the web build, as handoff 201 already said, and this audit did not find a reason to withdraw that: the economy invariant holds at 403 devices, every mint vector without a session refuses, 2,846 tests are green on main, all 33 routes render, the 404s are honest. Two things have to happen *before* a tester round, not after, because they only matter once testers exist: close #1 and #2 (tester device ids and balances would be readable with the shipped anon key), and commit the deployed source of the two drifted edge functions (#3a) so that the first person who deploys the bug pipeline does not break it.

**What I would not want a tester to hit:** the multiplayer lobby, still — it promises auto-start on two screens, no room has ever reached `playing`, two real clients in one room has never been tried, and this audit added two more MP items (#14d, #14g). On native specifically: a lost board, because it plays the win chime (#5). On any platform: a 2-player or 4-player COMPLETE, because the banner says +50% when the bonus is 75% or 25% (#6); the Settings "4 colours" toggle, because it does nothing on the game screen (#7).

**The single most valuable thing left:** one migration file that finishes what 20260831170000 started — RLS on the pre-reset ledger archive and SELECT revoked from `anon` on the seven definer views — proven by the same two `SET ROLE anon` queries this audit used. It is a two-statement change, it closes the only findings that leak identity and balance history to anyone with the public key, and it is the one fix that gets *more* urgent with every tester who installs. The structural fix behind everything else is Roye's merge decision on `claude/vamos-caps-align-celebration-flppo0`: until it lands, main is a version of the product that stopped running on 2026-09-08.

Committed and pushed on `origin/claude/caps-deep-audit-nr8z17` (branch from `ef55640`; not merged, no version bumped, no flag, cue, card size, arc, economy value, `game_rooms` or `room_players` row touched, nothing deployed, nothing submitted). Handoff 210 in `vamos_handoffs`; the same text in `HANDOFF.md` beside this file.

