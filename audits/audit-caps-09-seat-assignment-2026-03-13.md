# Audit — VAMOS CAPS 09: Seat Assignment Hardening + Numeric Room Codes
**Date:** 2026-03-13

## Scope
Unify seat assignment to single source of truth (server), switch room codes to numeric-only.

## Changes Made

### utils/realtimeMultiplayer.ts

**New `onRoomState` callback in RealtimeClientCallbacks:**
- `onRoomState?: (players: { id: string; name: string; seat: number; isHost: boolean }[]) => void`
- Allows guest lobby to receive authoritative seat mapping from server

**Server broadcasts `ROOM_STATE` after every presence sync:**
- `broadcastRoomState()` — called at end of `syncClientsFromPresence()`
- Payload: `{ players: [{ id, name, seat, isHost }] }` — server-authoritative seat data
- Every time presence changes, all players get the correct seat mapping

**Client handles `ROOM_STATE` message:**
- Routes to `onRoomState` callback with player array

**`generateOnlineRoomCode()` changed to numeric-only:**
- Old: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (32 chars, alphanumeric)
- New: `0-9` (10 digits), 6 digits, no leading zero
- Code space: 900,000 codes (sufficient for concurrent rooms)

### app/lobby/internet-host.tsx

**Seat data from server, not presence array index:**
- Old: `p.map((pl, idx) => ({...seat: idx...}))` — presence array index
- New: `server.getClients().map((c) => ({...seat: c.seat...}))` — server's authoritative seat from `getNextSeat()`

### app/lobby/internet-join.tsx

**Guest lobby consumes `ROOM_STATE` for seats:**
- `onRoomState` callback registered before `connect()` — sets `connectedPlayers` in Zustand with server-authoritative seats
- `onPresenceChange` now only updates local player list display (no Zustand store write)

**Numeric room code input:**
- `keyboardType="number-pad"` — shows number keyboard on mobile
- `placeholder="123456"` — matches new code format
- `onChangeText` strips non-digits: `t.replace(/[^0-9]/g, '').slice(0, 6)`
- Removed `autoCapitalize="characters"` — not needed for numbers
- Validation regex: `/^[0-9]{4,6}$/` (was `/^[A-Z2-9]{4,6}$/`)
- `.toUpperCase()` removed from `handleJoin` — no longer needed

## Divergence Fix Analysis

| Path | Before (BUG) | After (FIXED) |
|------|--------------|---------------|
| Host lobby → Zustand | `seat: idx` (presence array index) | `seat: c.seat` (server's `getNextSeat()`) |
| Guest lobby → Zustand | `seat: idx` (presence array index) | `seat: p.seat` (from ROOM_STATE broadcast) |
| CARDS_DEALT `playerIndex` | Correct (from server sort-by-seat) | Unchanged |
| results.tsx `mySeat` lookup | Read from Zustand (was wrong) | Now correct (Zustand has server seats) |

## Why Seats Could Diverge Before
1. Player A joins (seat 0, index 0) ✓ match
2. Player B joins (seat 1, index 1) ✓ match
3. Player B disconnects, Player C joins → server gives C seat 1 (gap fill), but presence array has C at index 1 ✓ lucky match
4. Player B reconnects → server keeps B at seat 1, C at seat 2. Presence array order is non-deterministic → index may not match seat

After fix: seats always come from `getNextSeat()` on server, broadcast to all via ROOM_STATE.

## Risk Assessment
- **WiFi path:** Zero impact
- **Game screens:** Zero changes
- **Existing flow:** Preserved — successful connections work exactly as before
- **Room code backward compatibility:** Old alpha codes won't work with new numeric validation — no migration needed since rooms are ephemeral
