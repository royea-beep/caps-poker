# Branches — 65 on origin, measured 2026-09-10

`git rev-list --count` against `origin/main` (`ef55640`) after fetching every branch to depth 300.

| branch | last commit | ahead | behind | migration files only here |
|---|---|---|---|---|
| **claude/vamos-caps-align-celebration-flppo0** | 2026-09-09 | **33** | 8 | **1** — `20260908000000_close_submit_score_chip_faucet.sql`, APPLIED TO PRODUCTION 2026-09-08 (ledger `20260908213547`) |
| claude/caps-001-audit | 2026-09-07 | 3 | 251 | 0 |
| feat/server-deal-phase-a | 2026-07-31 | 14 | 595 | 5 (`20260801090000` … `20260801093000`, not in the ledger by name) |
| build-tracker-skill-2026-05-21 | 2026-05-21 | 2 | 988 | 0 |
| 9 other branches | — | 1 each | 572–988 | 0 |
| 51 other branches | — | 0 | 92–988 | 0 — fully merged, deletable by content |

What the first row means: **main is behind production.** The database runs `close_submit_score_chip_faucet`; the repo on main still carries the pre-fix `submit_score` history, and main's `CLAUDE.md` still says the faucet is "STILL OPEN". The branch also holds 14 test files (`tests/stranger-walk.mjs`, `tests/serve-dist-like-prod.mjs`, `tests/submit-score-contract.test.ts` …), 9 docs and the corrected CLAUDE.md that handoffs 199–207 describe. Until it merges, every reader of main reads a version that has not run since 2026-09-08. Merging is Roye's call; this audit did not merge.
