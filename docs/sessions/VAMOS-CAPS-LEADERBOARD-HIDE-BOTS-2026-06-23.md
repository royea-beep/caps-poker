# VAMOS CAPS LEADERBOARD-HIDE-BOTS — Profile & Fix

**Date:** 2026-06-23 · **Branch:** `fix/leaderboard-hide-bots` · **Author:** PM session

---

## TASK 1 — Profile (safety): do in-game bots read from the `leaderboard` table?

**No.** Every game mode builds bots from local code, never the `leaderboard` table:

- `app/sit-and-go.tsx:90` — `const BOT_NAMES = ['Ace', 'Bluff', 'Chips', 'Flush', 'River'];`
- `app/sit-and-go.tsx:181` — bots constructed inline: `...BOT_NAMES.map((name, i) => ({ id: \`bot_${i}\`, ... }))`
- Bot hands come from game logic: `initializeGameMulti(numberOfPlayers)` →
  `app/game.tsx:775`, `app/sit-and-go.tsx:236`, `app/tournament.tsx:205`,
  and `initializeGame()` in `app/quick-poker.tsx:36`.
- `app/game.tsx:770` `get_bot_difficulty` RPC returns only a difficulty level, not identity/chips.

The only reads of the `leaderboard` table are **display surfaces**:
- `app/leaderboard.tsx:38` → `getLeaderboard()` → `from('leaderboard').select('*')` (public board)
- `app/rank.tsx:61-74` → `from('leaderboard')` count/own-row (your rank widget)
- `get_leaderboard(p_device_id,...)` RPC → used by home `app/(tabs)/index.tsx:1191`

**Conclusion:** the 35 `device_id LIKE 'bot_%'` rows are display-only seed data. Hiding or deleting
them is safe and does not affect in-game opponents.

**The bot rows:** 35 rows, total_chips 400–24,339, 30/35 have `hands_played > 0` (so they also pass the
`get_leaderboard(int)` overload's `WHERE hands_played > 0` filter), last `updated_at` 2026-03-30. Static
seed — no code path INSERTs `bot_%` into `leaderboard`, so a cleanup will hold.

---

## TASK 2 — Fix

### Client display filter (landed on this branch — ships with 506; durable even if rows persist)

- `utils/leaderboard.ts` `getLeaderboard()` — added `.not('device_id', 'like', 'bot_%')`.
  The screen renders rank as `index + 1` (`app/leaderboard.tsx:64`), so positions renumber automatically.
- `app/rank.tsx` — added `.not('device_id', 'like', 'bot_%')` to both count queries (rank position + total),
  so a player's rank and the total-players count reflect real players only.
- `app/(tabs)/index.tsx` — filter `bot_%` out of the `get_leaderboard` RPC result and recompute the home
  rank widget's position from the bot-filtered, chip-sorted order.

**Verify:** `tsc` 0 · `jest` 2505/2505. Live check of the new query (top 20, bots excluded) → 0 bot rows;
new top 5 = real players only (`1eb2…` 39,800 · `a602…` 20,650 · `Avi Avitan` 6,775 · …).

### Safe live DB cleanup (OWNER-APPLIED — fixes live NOW, no app release)

Because the game never reads these rows, deleting them is safe and fixes every surface immediately
(including the server-computed ranks in the `get_leaderboard` RPC), with zero code change:

```sql
DELETE FROM leaderboard WHERE device_id LIKE 'bot_%';   -- removes 35 seed bot rows
```

Optional belt-and-suspenders (so any future re-seed never surfaces) — add to BOTH `get_leaderboard`
overloads inside the `FROM leaderboard` scan:

```sql
WHERE device_id NOT LIKE 'bot_%'
```

Once the rows are gone (or the RPC excludes them), the home rank widget is exact and the client filter
above becomes a harmless no-op safety net.

---

## TASK 3 — Verify

- `tsc` 0 · `jest` 2505 / 2505 passed (34 suites).
- Leaderboard screen query now returns **zero** `bot_%` rows (verified against live DB).
- In-game bots **unaffected**: their source (`BOT_NAMES` + `initializeGameMulti`/`initializeGame`) was not
  touched; only display queries changed. Sit & Go / game still fill bot opponents normally.

## Constraints honored
No deploy / OTA / build / submit. Client fix contained to the 3 display surfaces, on branch
`fix/leaderboard-hide-bots`. DB cleanup SQL provided, **not** applied (owner authorizes any prod DB change).
