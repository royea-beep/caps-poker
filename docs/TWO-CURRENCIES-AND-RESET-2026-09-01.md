# TWO-CURRENCIES-AND-RESET — 2026-09-01

Split practice from real, then reset the real balance clean before testers arrive. Roye approved the
model (two currencies, cosmetics sink, merch/ads at scale, real money later & geo-fenced) and the
reset (everyone, including his own account). Branch `claude/vamos-caps-align-celebration-flppo0`.

## Current currency shape — the actual schema, not an assumption
- **The real balance is exactly one column: `leaderboard.total_chips`** (integer, default 2000).
  `leaderboard.chips` is a **`GENERATED ALWAYS AS (total_chips) STORED`** read-alias — a mirror, never
  written directly (confirmed: `is_generated=ALWAYS`, all 489 rows `chips=total_chips`).
- **Practice is not in the database at all.** It is client-local and chip-neutral by construction:
  `app/results.tsx:541-546` settles a practice hand with `record_hand_net(deviceId, 0, handId, true)`
  — **net 0** — so the real balance never moves; `gameStore.chips` (line 69) is documented "practice
  never touches chips or leaderboard.total_chips."

## Real vs practice — defined precisely
- **Real currency = `leaderboard.total_chips`.** What multiplayer settles in (`record_hand_net`,
  zero-sum), what the shop sells against, what the leaderboard ranks. Client mirror: `gameStore.chips`,
  hydrated **server-wins** on launch (see below).
- **Practice currency = client-local, free, unranked, never sold.** A per-session demo tally
  (`practiceSessionNet`) that resets each session and settles nothing on the server.

## On-screen distinction — already built
A player can never confuse the two: in practice the game screen shows a pill **"🤖 Practice · no
chips"** (`app/game.tsx:1449-1455`, a11y label "Practice, no chips at stake"); when a session net
exists it reads "🤖 Practice · +N chips" — explicitly "a demo counter, separate from real chips." A
real hand shows the ordinary balance with no such pill. Absence of the pill = real chips at stake.

## Settlement untouched — this was display/labelling, not a settlement change
Per the brief's "prefer the smaller change": the split **already exists in behaviour and on screen**,
so **the smaller change was zero settlement change.** `record_hand_net` (the proven zero-sum path) is
**untouched**; the practice-neutrality (net 0), the server-wins adoption, and the practice pill were
all already in the code. The only code added this sprint is the config key below. **Practice stays
free and frictionless** — confirmed: practice settles net 0 and risks nothing.

**Why the reset survives on the field (server-wins).** The home bootstrap **adopts the server balance**
on launch and never pushes the stale local default over it (`app/(tabs)/index.tsx:814-828`:
"server-wins by construction … leaderboard.total_chips agree on ONE number with no client-wins push").
So a device holding a stale local 4,875 adopts the reset's 2,000 on next launch — the reset holds
without any client change.

## Config-driven starting value
Added **`app_config.starting_chips = 2000`** so the value retunes without a deploy, like the faucet.
2000 matches `leaderboard.total_chips`'s column default and the `starting_grant` the new-device trigger
already writes, so a reset device and a brand-new tester begin identical. (Wiring the new-device INSERT
path to read this same key is a later, out-of-scope change; the values already agree.)

## THE RESET

### Design — a clean baseline, not a delta (so the gap cannot return)
Migration `supabase/migrations/20260901000000_two_currencies_reset.sql`. A per-device **delta** reset
(start − current) would move float and ledger by the same amount and **leave the 335,330 gap intact** —
recreating the exact bug it is meant to end. So it re-baselines:
1. **Archive** the whole ledger → `chip_transactions_prereset_20260901` (history preserved, recoverable).
2. **Reset only the real balance:** `UPDATE leaderboard SET total_chips = 2000` for every device (the
   generated `chips` alias follows; `elo`, `hands_played`, `hands_won`, `biggest_win` untouched — "only
   the balance resets" is literal). UPDATE, never INSERT, so the AFTER-INSERT starting-grant trigger
   cannot double-fire.
3. **Re-baseline the ledger:** delete all rows, then write ONE `reset_baseline` opening-balance row per
   device = 2000. Now every device has `total_chips = 2000` AND its ledger sums to 2000 — float = ledger
   globally and per-device, gap = 0 from a recorded cutoff. Atomic (one transaction).

### Dry run on a branch first (Rule 11)
Dev branch `two-currencies-reset-dryrun` (`vtumjrierfiytpaaayec`). The migration history does not
rebuild the DB, so a **minimal replica was hand-built** (leaderboard with the generated `chips` alias,
`chip_transactions`, `device_identity`, the starting-grant trigger) and **seeded to mirror production**:
10 devices, 2 bound, with **4,000 of unrecorded float injected** (float 34,075 > ledger 30,075, gap
4,000). After the reset on the branch:
- 10/10 devices at 2000; **float 20,000 = ledger 20,000, gap 0** (was 4,000).
- generated `chips` alias = total_chips on all 10; **2 bindings survived**; archive held the 10 pre-reset
  rows; **dev-3 elo=1200 / hands_played=40 unchanged** (only the balance reset).
- Settlement demo: a real hand net +150 moved dev-1 2000→2150 (ledgered, gap stayed 0); a practice hand
  net 0 left it at 2150. **Branch deleted after.**

### Production dry-run preview — shown before applying
489 devices; 430 change value (59 already at 2000). Before: float **1,170,858** / ledger **835,528** /
**gap 335,330**. Predicted after: float **978,000** = ledger **978,000**, **gap 0**; float delta
**−192,858**; ledger rows **4,237 → 489**. Survivors predicted intact: bindings 6, trophies 6,
achievements 154, hand_history 71, server purchases 0. The dry run was clean, so — per the brief and
Roye's approval — the reset was applied.

### AFTER on production — fresh SELECT
| metric | value |
|---|---|
| devices all at 2000 | **489 / 489** (max = min = 2000) |
| float / ledger / **gap** | 978,000 / 978,000 / **0** (was 335,330) |
| generated `chips` alias = total_chips | 489 / 489 |
| ledger rows (all `reset_baseline`) | 489 |
| archive `chip_transactions_prereset_20260901` | 4,237 rows preserved |
| **bindings** (device_identity) | **6** — untouched |
| trophies (device_cups) | 6 — untouched |
| achievements | 154 — untouched |
| hand_history | 71 — untouched |
| cosmetics (client-local; purchases/chip_purchases) | 0 server rows — ownership is not chips, untouched |
| `app_config.starting_chips` | 2000 |

### One real hand afterwards — real moves, practice does not (live `record_hand_net`, untouched)
A synthetic probe at the 2,000 baseline, then cleaned up. Its ledger, verbatim:
- opening `starting_grant` **+2000**
- **real hand** → `hand_net` **+150** (the settlement moved the real balance), `rake` −7, `play_grant` +80
- **practice hand** → `hand_net` **0** (chip-neutral — real chips did not move via settlement),
  `play_grant` +40 (the learning faucet, paid to practice at `play_grant_practice_pct` = half of real's 80)

So the **real hand's net moved the balance; the practice hand's net was 0.** The `rake`/`play_grant` are
the config-driven house/faucet mechanics (untouched). Probe deleted; final state re-verified: **489
devices at 2000, float = ledger = 978,000, gap 0, bindings 6, probe residue 0.**

## What survives the reset — each confirmed
bindings (6) ✓ · cosmetics (client-local; 0 server purchase rows) ✓ · achievements (154) ✓ ·
hand_history (71) ✓ · trophies (6) ✓ · skill/stats (elo, hands_played, …) ✓. **Only balances reset.**
Practice currency: **left as-is** — it has no server state and no meaning, so it starts fresh for free
the moment a player opens practice again; nothing to reset.

## Production unchanged otherwise
No payment flag enabled, no merch/ads built, no real-money anything. `record_hand_net` and the zero-sum
property untouched. No art, nav, security fix, or `KILL_Board` touched. The gap that held across many
prior sprints (335,330) is now **0 by deliberate, approved reset** — float and ledger agree from a
recorded cutoff, and the archive preserves the pre-reset ledger.
