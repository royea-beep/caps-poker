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
| Edge functions: repo = deployed | see `EDGE-FUNCTIONS.md` | 8 of 14 hand-deployed; diff results in that file |
| TestFlight public link disabled | COULD NOT VERIFY | needs an ASC read (`testflight-manage.yml` dispatch); not dispatched from an audit |
| App Store listing blank | COULD NOT VERIFY today | last read 2026-09-08 (handoff 203), no reason to expect change |
| PITR / backups add-on | COULD NOT VERIFY | organization endpoint denies; WAL archiving was healthy on 2026-09-08 |

## NEVER VERIFIED — stated once

Native iOS rendering on a real device (every visual verdict in this project is a web export in headless Chromium, and the sound finding above has never been heard by anyone). The bug reporter's media path end to end. Two real clients in one room — `room_players` has 0 rows and no room has ever reached `playing` in the product's history, so every multiplayer verdict is code-read or single-client. Multiplayer under any load. This audit added nothing to that list and removed nothing from it: it had no device, no second client and no billing access either.

VERDICT-PLACEHOLDER
