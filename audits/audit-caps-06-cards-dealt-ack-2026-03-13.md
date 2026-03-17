# Audit — VAMOS CAPS 06: ACK + Retry for CARDS_DEALT
**Date:** 2026-03-13

## Scope
Implement acknowledgment and retry protection for CARDS_DEALT in internet multiplayer.

## Changes Made

### utils/realtimeMultiplayer.ts

**New infrastructure (top of file):**
- `DELIVERY_RETRY_INTERVAL_MS = 2000` — retry every 2 seconds
- `DELIVERY_MAX_RETRIES = 5` — max 5 retries (10s total window)
- `PendingDelivery` interface — tracks playerId, handId, payload, retryCount, timerId, sentAt
- `rtLog(tag, msg, data?)` — structured logging with timestamp

**RealtimeServer additions:**
- `handId: number` — monotonic counter, incremented each deal
- `pendingDeliveries: Map<string, PendingDelivery>` — per-player tracking
- Self-message filter: `if (senderId === this.hostId) return;` at top of handleIncomingMessage
- `CARDS_DEALT_ACK` case in message handler → calls handleCardsDealtAck
- `handleCardsDealtAck(senderId, data)` — validates handId match, clears timer, removes pending
- `scheduleRetry(playerId)` — setTimeout-based retry with bound check
- `clearAllPendingDeliveries()` — cancels all timers, clears map
- `startGame()` modified: increments handId, clears prior deliveries, sends with handId, tracks each guest
- `stop()` modified: calls clearAllPendingDeliveries before teardown

**RealtimeClient additions:**
- `lastProcessedHandId: number = -1` — dedup tracker
- CARDS_DEALT handler: always sends ACK immediately, then checks dedup before processing
- `disconnect()` modified: resets lastProcessedHandId

## Verification

### ACK flow
1. Server calls startGame() → handId increments → CARDS_DEALT sent with handId
2. Client receives → immediately sends CARDS_DEALT_ACK with matching handId
3. Server receives ACK → clears timer → removes from pendingDeliveries
4. Log: `[RT SERVER] ACK received from {id} for handId {n}`

### Retry flow
1. Server sends CARDS_DEALT → schedules retry timer (2s)
2. Timer fires → checks retryCount < 5 → resends → schedules next retry
3. Log: `[RT SERVER] Retrying CARDS_DEALT to {id} {attempt: n, maxRetries: 5, handId: m}`

### Failure flow
1. After 5 retries with no ACK → timer fires → retryCount >= max
2. Removes from pendingDeliveries
3. Fires callbacks.onError with descriptive Error
4. Log: `[RT SERVER] CARDS_DEALT delivery FAILED for {id} after 5 retries`

### Duplicate safety
1. Client receives retried CARDS_DEALT → handId <= lastProcessedHandId
2. Still sends ACK (server may have missed prior ACK)
3. Does NOT fire onCardsDealt callback again
4. Log: `[RT CLIENT] Duplicate CARDS_DEALT ignored {handId: n, lastProcessed: n}`

### Edge cases
- New hand clears all pending deliveries from prior hand
- Server stop clears all pending deliveries
- Client disconnect resets lastProcessedHandId
- Stale ACK (wrong handId) is logged and ignored
- Self-message filter prevents host from processing own broadcasts

## Risk Assessment
- **WiFi path:** Zero impact — changes are RealtimeServer/Client only
- **Game screens:** Zero impact — no changes to multiplayer-game.tsx, results.tsx, lobby screens
- **Backwards compatible:** handId field is additive; client handles missing handId gracefully (typeof check)
