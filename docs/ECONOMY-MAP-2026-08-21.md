# CAPS Economy Map — 2026-08-21

**Read-only.** Nothing was built, designed, or changed. Binding, throttle and the four economy
functions were not touched.

> **Headline: wagering already exists.** In multiplayer, chips move *between* players — zero-sum,
> settled by the server, with a house rake. It is live in production today.

---

## 1. Sources and sinks — actual, from `chip_transactions` (5,433 rows)

### Faucets

| event_type | rows | total | amount | trigger |
|---|---:|---:|---|---|
| `daily_streak` | 1,874 | **+953,900** | 500–1,500, derived by streak day | `claim_daily_streak`, home mount |
| `daily_login` | 2,217 | +110,850 | 50 fixed | **dead** since 2026-07-02 (removed from client) |
| `daily_reward` | 994 | +29,820 | 30 fixed | `claim_daily_reward`, home mount |
| `hand_won` (legacy) | 109 | +5,025 | 25–100 | old `earn_chips` path, last 2026-08-01 |
| `hand_net` (wins) | 80 | +3,888 | 0–250, **derived** from board results | `record_hand_net` |
| `ach_*` (6 kinds) | 52 | +8,600 | fixed 100–500 | `record_reward` on unlock |
| first_game, low_chip_rescue, share_hand, quick_poker_win, hand_win, sit_n_go_win, streak_5_wins, ach_play_10, emergency_chips | ~65 | +9,160 | fixed | assorted |

### Sinks

| event_type | rows | total | amount | trigger |
|---|---:|---:|---|---|
| `quick_poker_buyin` / `buy_in` | 43 | −5,900 | 50–200 | **legacy**, ended 2026-06-24 |
| `hand_net` (losses) | 48 | −3,438 | −38…−250, derived | `record_hand_net` — a **transfer**, not destruction |
| `rake` | 36 | **−154** | 5% of winnings | server-computed, `app_config.hand_rake_pct = 5` |
| rebuy_500, buy_emotes, buy_avatar, hand_won-debit | 10 | −1,150 | fixed | shop / rebuy |

**Amount provenance:** every amount is fixed or server-derived **except** `record_hand_net`, whose
`p_net` is **client-supplied** (clamped ±10,000, daily gain cap 20,000/device). In MP the "client"
is the *server* (`resolve-hand`); in solo it is the player's own client.

## 2. Net: massively positive — inflationary

```
total credited   1,121,093
total debited      -10,642      (0.95% of credits)
LEDGER NET      +1,110,451
outstanding      2,457,144 chips across 1,036 devices (avg 2,372)
```

Most debits are not even sinks — `hand_net` losses are transfers to other players. **True
destruction** (rake + buy-ins + cosmetics) is ≈ **7,100 chips ever = 0.6% of everything created.**
The rake, the only ongoing sink, has burned **154 chips** in its lifetime. The faucet is roughly
**160× the drain.**

## 3. Is it wagering today? **Yes — proven at row level**

Every MP room+hand sums to **exactly zero** across its players, plus rake. Sampled 20 room+hand
groups of 3 and 4 players: `net_across_players = 0` in every one.

**The path:** [resolve-hand/index.ts:159](supabase/functions/resolve-hand/index.ts:159) — the
**server** computes deltas via `calculateChipDeltasCore`, then
[:184](supabase/functions/resolve-hand/index.ts:184) calls `record_hand_net` once **per seat** with
`p_hand_id = mp:<room>:<hand>:<device>`. [utils/chipMath.ts:63](utils/chipMath.ts:63) is a pot
model: each player pays `potPerBoard` per board, board pot = `potPerBoard × playerCount`, winner
takes the pot, ties split with the rounding remainder distributed
([:79–88](utils/chipMath.ts:79)). The COMPLETE bonus is explicitly zero-sum, taken from the losers
([:104–116](utils/chipMath.ts:104)).

**Does a loser's balance decrease? YES** — 48 `hand_net` debit rows, −3,438 total. Floored at zero
by `GREATEST(0, …)`, so a loss never pushes a player negative.

## 4. Practice: chip-neutral — confirmed

- [app/game.tsx:612](app/game.tsx:612) — `if (!isPractice) addChips(-buyIn)`
- [app/results.tsx:484](app/results.tsx:484) — the `hand_net` write is gated on `!isPracticeGame && !isMultiplayer`
- [app/lobby/index.tsx:187](app/lobby/index.tsx:187) and [:306](app/lobby/index.tsx:306) — bot rows are XP only, zero chips

Roye's rule holds. Nothing to flag.

## 5. Stake selection: fixed, not chosen

MP stake is server-side: `app_config.pot_per_board = 25`, read by `loadConfig()`
([resolve-hand/index.ts:38](supabase/functions/resolve-hand/index.ts:38)) — a client cannot
influence it. Match cost = `potPerBoard × boardCount`: 4P = 50, 3P = 75, 2P = 100. A player-facing
"Pot Per Board" row exists at [app/settings.tsx:1047](app/settings.tsx:1047), but it edits the
**local solo** config only. No stake tiers, no per-table stakes, no picker.

## 6. At zero chips: blocked, and the rescue is unreachable

`canAffordMatch` gates entry at [play.tsx:39](app/(tabs)/play.tsx:39),
[lobby/index.tsx:140](app/lobby/index.tsx:140), [lobby/table.tsx:148](app/lobby/table.tsx:148) — a
busted player cannot start a match, solo or MP.

The designed rescue `claim_emergency_chips` takes `p_user_id uuid`. Most CAPS players are
device-anonymous with `auth.uid()` NULL, so it cannot be called for them —
[app/gameover.tsx:65](app/gameover.tsx:65) says so and deliberately does not call it. **One**
`emergency_chips` row exists, from April. **21 devices sit at exactly 0; 26 are below 50**, the
cheapest possible match. Their only way back is tomorrow's `daily_streak`.

## 7. What a wagering tier would need — present / absent

| piece | state | where |
|---|---|---|
| wallet + balance | **present** | `leaderboard.total_chips`, single writer |
| ledger | **present** | `chip_transactions`; append-only in normal operation, idempotent per hand via a partial unique index on `(device_id, reference_id)` |
| pot | **present** | [chipMath.ts:63](utils/chipMath.ts:63) |
| payout split 3–4 players | **present** | [chipMath.ts:79–88](utils/chipMath.ts:79), ties + remainder |
| **server settlement** | **present** | [resolve-hand:159–190](supabase/functions/resolve-hand/index.ts:159), `mp_server_adjudication_enabled = TRUE` — **the hardest part is done** |
| house rake | **present** | 5%, server-side, live |
| stake tiers / table stakes / picker | absent | — |
| visible pot or stakes during a hand | absent | values already returned in the outcome, nothing renders them |
| tournaments | absent | only `daily_missions` + `user_missions`; SNG functions exist but `sng_eliminate` has **no grants** (revoked, dormant); 1 `sit_n_go_win` row ever |

**Ledger mutators** (so "append-only" is precise): `delete_user_account`, `purge_user_data` (both
GDPR), `merge_guest_to_user` (re-keys `user_id`, does not change amounts), and
`test_e2e_anonymous_flow` — which has **no grants**, so it is unreachable from a client.

## 8. Bot / human boundary in MP — the gate, and it is provable

**Structural:** `public.room_players` has **no bot column of any kind** — no `is_bot`, no AI flag. A
seat exists only via `join_table`, and `app_config.join_requires_session = TRUE`. A repo-wide search
for `is_bot|isBot|addBot|fillWithBots` returns only the lobby *display* filter at
[app/lobby/index.tsx:194](app/lobby/index.tsx:194).

**The gate:** [constants/featureFlags.ts:28](constants/featureFlags.ts:28) —
`PRACTICE_LIVE_ENABLED = false`, consumed at [app/lobby/index.tsx:210](app/lobby/index.tsx:210).
With it false a bot row **never** calls `join_table`; it is pure local practice. Bot and human
tables are separated by `table_kind='bot_practice'`, DB-sourced and authoritative.

**Not a bot despite the name:** `autoFilled`
([resolve-hand:112–122](supabase/functions/resolve-hand/index.ts:112)) is a **human** seat whose
player did not place in time — the server plays the cards it already dealt them.

**Provable: YES**, structurally and empirically — all **88** devices ever settled in an MP hand have
client telemetry in `analytics_events`. *Caveat, stated because an opponent would find it:* 2 of
those 88 are our own test-harness ids (`dev-s2-guest`, `dev-s2-host`). Our rigs, not product bots —
but they did move chips in MP settlement.

## 9. What is actually missing

**"Players can win and lose chips against each other in multiplayer" already works today, in
production, settled by the server, zero-sum, with a rake.** It is not a thing to build.

| missing | size |
|---|---|
| **Integrity — gates everything else.** `record_hand_net` is EXECUTE-granted to `anon`, takes a client-supplied `p_net`, and is **not** bind-gated and **not** throttled (only `econ_authz_probe`, which logs). The four guarded functions are `earn_chips`, `spend_chips`, `update_leaderboard_elo`, `update_mission_progress` — the biggest chip mover is not among them. Same for `claim_daily_streak` and `claim_daily_reward`, the two largest faucets. | **1 day** |
| Stake tiers / per-table stakes — server already reads `pot_per_board` from `app_config`; per-room is a column plus a picker | 1–2 days |
| Visible pot and stakes during a hand — the numbers are already in the `resolve-hand` outcome | 0.5 day |
| Working zero-chip rescue — `claim_emergency_chips` needs a `device_id` overload | 0.5 day |
| Tournaments — genuinely new | 1 week+ |
| Sink balance — design, not code. At 0.6% drain the currency is already near-meaningless | — |

*(handoff: `vamos_handoffs` id 80)*
