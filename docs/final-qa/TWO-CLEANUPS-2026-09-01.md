# TWO-CLEANUPS — 2026-09-01 — delete the leftover attack row, remove the stale build

Two housekeeping items from FINAL-ONBOARDING-QA (h150). main @ `baff424` (unchanged — no merge/bump).
Roye caught the first: the economy gap read **−2,000**, not 0.

## 1 — The leftover attack residue (gap −2000 → 0)
**Root cause:** in the security re-attack, `submit_score('QA-ATTACK-SCORE', …, 999,999,999)` inserted a
`leaderboard` row; the **`ledger_starting_grant` trigger fired on that insert** and wrote a +2000
`chip_transactions` (`starting_grant`) row. I deleted the leaderboard row but the trigger's ledger row
survived → an orphan ledger device → gap −2000. (submit_score itself never writes the ledger; the
trigger did.)

**Found before deleting — every orphan and every attack-shaped row, scanned across all 32 base tables
with a `device_id`:**
| table | device | row |
|---|---|---|
| chip_transactions | QA-ATTACK-SCORE | starting_grant +2000 (the orphan) |
| econ_score_gain_daily | QA-ATTACK-SCORE | gained 2000 (submit_score gain tracker) |
| econ_rate_counters | QA-ATTACK | rate counters (min + hour bucket) ×2 |
| analytics_events | QA-ATTACK, QA-ATTACK-SCORE | `econ_authz` probe log ×2 |

All 6 rows timestamped in the 22:31–22:32 attack window; **none has any real play** (no leaderboard,
no hand_history, not among the 6 bindings). No `RT-*` residue anywhere; `room_players` scanned
(read-only) — clean, untouched.

**Deleted exactly those 6 rows** (chip_transactions 1, econ_score_gain_daily 1, econ_rate_counters 2,
analytics_events 2). Nothing with real play touched; the 6 bindings untouched.

**Verified by fresh SELECT:** orphan ledger devices **0**, leaderboard-without-ledger **0**,
`sum(chip_transactions)` = `sum(leaderboard.total_chips)` = **1,005,180**, **gap = 0**. Residue
remaining anywhere: **0**.

## 2 — Stale committed web exports (git-rm'd + gitignored)
Not one but **three** stale committed web-export dirs (all carry `_expo/static/js/web` bundles; Vercel
rebuilds fresh, so none affected production — but each is a local-testing trap; the first cost two
phantom QA findings):
- `web-dist/` — stale 2026-06-17
- `dist-web/` — stale 2026-06-17
- `web-dist-new/` — stale 2026-04-14

`git rm -r` all three (118 files, −6,728 lines) and added explicit `.gitignore` lines (the existing
`web-*-dist/` pattern misses these exact names, which is how they were committed). Other generated
artifacts checked: `supabase/functions/_shared/` is correctly untracked; no other committed build
output found. Commit `7e3cc48` on the branch (no merge to main).

## 3 — Final state (what testers arrive into)
**devices 501 · devices in hand_history 8 (14 moved off 2000 via the play faucet) · gap 0 · bindings 6
· hands 74 · purchases 0 · min balance 2000.**
Flags (unchanged, from h150): payments **off** (`iap_enabled=false`), missions **inactive**,
`KILL_Board` **true**, `verify_jwt` **on** (verify-purchase).

**Still unverified — the testers' job:** native rendering on a device (513 is the first build the
felt/beam/backdrop/gilded masthead/chip bevel reach iOS), two-client multiplayer, MP under load.

Not merged, no version bump, nothing to App Store Connect. No economy value / reset / security fix /
art / nav / flag touched — only the attack residue I created and the stale build artifacts were removed.
