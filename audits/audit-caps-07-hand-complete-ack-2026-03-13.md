# Audit — VAMOS CAPS 07: ACK + Retry for HAND_COMPLETE
**Date:** 2026-03-13

## Scope
Extend the CAPS 06 ACK/retry pattern to HAND_COMPLETE. Generalize the delivery infrastructure to avoid parallel duplicate mechanisms.

## Changes Made

### utils/realtimeMultiplayer.ts

**Infrastructure generalization:**
- `PendingDelivery` interface: added `messageType: string` field
- New `deliveryKey(messageType, playerId)` → composite key `"CARDS_DEALT:abc123"`
- `handleCardsDealtAck` replaced by generic `handleDeliveryAck(messageType, senderId, data)`
- New `trackDelivery(messageType, playerId, handId, payload)` helper — encapsulates Map.set + scheduleRetry
- `scheduleRetry(key)` now reads `messageType` from the pending entry for log messages and retry sends
- `startGame()` updated to use `trackDelivery` instead of inline Map.set

**HAND_COMPLETE changes (server):**
- `sendHandComplete(result)` now sends per-player via `sendToPlayer` instead of `broadcastToAll`
- Adds `handId` to payload: `{ ...result, handId: this.handId }`
- Tracks each guest via `trackDelivery('HAND_COMPLETE', client.id, ...)`
- Skips host and disconnected clients
- Logs each send

**HAND_COMPLETE changes (client):**
- New `lastCompletedHandId: number = -1` dedup tracker (separate from `lastProcessedHandId` for CARDS_DEALT)
- On HAND_COMPLETE receipt: sends `HAND_COMPLETE_ACK` with `{ handId }` immediately
- Dedup: only processes callback if `handId > lastCompletedHandId`
- Always ACKs even on duplicate (server may have missed prior ACK)
- Reset to -1 on disconnect

**Message router (server):**
- Added `HAND_COMPLETE_ACK` case → `handleDeliveryAck('HAND_COMPLETE', senderId, data)`

## Verification

### HAND_COMPLETE flow
1. Host calls `sendHandComplete(result)` → iterates connected guests
2. For each guest: `sendToPlayer(id, 'HAND_COMPLETE', {...result, handId})` + `trackDelivery`
3. Guest receives → sends `HAND_COMPLETE_ACK {handId}` → processes callback
4. Server receives ACK → `handleDeliveryAck('HAND_COMPLETE', ...)` → clears timer + pending

### Retry flow (same as CARDS_DEALT)
- Timer fires every 2s → up to 5 retries → onError on exhaustion

### Dedup flow
- Guest tracks `lastCompletedHandId` separately from `lastProcessedHandId`
- Duplicate HAND_COMPLETE: ACKed but not re-processed (no double navigation)

### Coexistence with CARDS_DEALT tracking
- Composite key ensures `CARDS_DEALT:abc123` and `HAND_COMPLETE:abc123` are independent entries
- Both can be pending simultaneously (though in practice they occur at different phases)
- `clearAllPendingDeliveries()` clears both on new hand or stop

## Risk Assessment
- **WiFi path:** Zero impact
- **Game screens:** Zero changes
- **BOARD_REVEAL:** Still uses `broadcastToAll` — lower priority, degrades display but doesn't block flow
- **Backwards compatible:** `handId` field is additive; client handles missing handId gracefully
