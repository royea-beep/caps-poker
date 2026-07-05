# PRACTICE-TO-LIVE — design + server contract (2026-07-05)

Round-1 (this branch) shipped the **verifiable** slice: the practice **session demo counter**
(economy-neutral, on-screen + results, `leaderboard.total_chips` untouched). The realtime
"jump to live MP when a real human joins" is **designed here** and deferred to round 2 — it
has a hard prod-server dependency (below) that the agent is correctly blocked from applying,
and its timer-sync/transition can only be validated with 2 physical devices.

## Blocker (STRATEGIST — prod DDL)
bot_practice tables are seeded `current_players=1` (fake bot seat). A real practicer joining a
2P table → `current_players=2` → `join_table` autostarts it → `status='playing'` → it **leaves
the waiting pool**, so a 2nd human can never find it. Fix — seed bot_practice with **0**:

```sql
-- in ensure_public_lobby(), the bot_practice INSERT: current_players 1 -> 0
-- VALUES (v_code, NULL, 'CAPS Bot', 'waiting', pc, 0, pc, ..., 'bot_practice');
UPDATE game_rooms SET current_players = 0
  WHERE is_public AND status='waiting' AND table_kind='bot_practice';
```
Scope the jump to the **2P (Heads-Up)** bot_practice table (clean "one opponent" semantics);
3P/4P bot rows stay pure local practice for now.

## Approach to the hard parts (a–e) — round 2 client, reusing utils/realtimeMultiplayer.ts

**a. Hold the realtime seat while running local practice.** On "Play now" (2P bot table):
`joinTable(code)` → real `room_players` seat + `is_host=true` (first joiner). Open a
`RealtimeServer` on `caps-room-{code}` (exactly like `/lobby/table` host) but DON'T deal —
run the local practice game as the visible filler. Keep the seat alive with the existing
`touchRoomPlayer(code)` heartbeat @25s (evict_ghost_seats reaps >90s → ~3 beats headroom).
This is the *same* seat-hold code the table room already uses.

**b. Synced 30s countdown from a single source.** The host is already authoritative for the
whole realtime game, so use the **host's broadcast** as the single clock (no NTP needed): when
the host's `onPresenceChange` sees a 2nd real client join, host stamps `deadline = now()+30000`
and broadcasts `{type:'JUMP_COUNTDOWN', deadline}` to the guest. BOTH clients render
`ceil((deadline - Date.now())/1000)` → identical countdown. (Optionally back it with
`game_rooms.started_at` set by the 2-real-player autostart for a server-anchored value; the
host broadcast is sufficient and matches the existing model.)

**c. Transition local-practice → realtime-MP without losing the seat.** At `min(bot-hand-end, deadline)`:
host calls `server.startGame(config)` and `router.replace('/multiplayer-game', {isHost:true,...})`;
guest, on the host's `START_GAME` broadcast, navigates as guest. This is the SAME
`dealAndGo()` path the table room already runs — we just gate it behind the 30s window instead
of firing immediately on presence-fill. The seat/room persist (launchedRef pattern keeps the
realtime connection alive across the nav). **On jump: discard the demo counter**
(`resetPracticeSessionNet()`), start the real MP game clean on the real bankroll.

**d. Edge — joiner leaves during the 30s.** Guest's presence drop fires the host's
`onPresenceChange` (p.length back to 1) → host broadcasts `{type:'JUMP_CANCELLED'}`, clears the
deadline, both return to normal practice. (Reuse the 10s `HOST_LOST_GRACE_MS` presence debounce
so a flicker doesn't false-cancel.)

**e. Edge — practicer between hands when human joins.** If no bot hand is mid-flight when the
countdown starts (on the results screen / pre-deal), jump **immediately** (don't wait 30s) —
the 30s only exists to let an in-progress bot hand finish.

## Economy
Practice stays zero-real-chips via the existing `isPractice` guard in game.tsx (no buy-in/settle)
+ results.tsx (skips submitScore/earn/streak/achievement/history/share). The demo counter is a
transient store field (`practiceSessionNet`, NOT persisted, NOT in partialize). The
`submit_score` +2000 delta-clamp stays as the backstop.

## Round-2 verification plan
Needs (1) the seeding change above live, and (2) 2 physical devices: device A joins the 2P bot
table (seat + practice), device B joins the same table → both see the synced 30s → jump to
`/multiplayer-game` on the real bankroll; verify `leaderboard.total_chips` moved only for the
REAL game, never practice; verify edges d/e.
