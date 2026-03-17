# Checkpoint — VAMOS CAPS 07: ACK + Retry for HAND_COMPLETE
**Date:** 2026-03-13

## Summary
Extended the CAPS 06 ACK/retry pattern to HAND_COMPLETE. Generalized the delivery infrastructure to support multiple message types via composite keys. HAND_COMPLETE is now sent per-player (targeted) instead of broadcast, enabling per-guest ACK tracking, bounded retry, and idempotent dedup.

## Files Changed
| File | Action |
|------|--------|
| `utils/realtimeMultiplayer.ts` | Generalized delivery tracking (composite key, trackDelivery helper, handleDeliveryAck), HAND_COMPLETE per-player send + ACK tracking, client HAND_COMPLETE dedup + ACK |

## Key Design Decision
HAND_COMPLETE changed from `broadcastToAll` to per-player `sendToPlayer`. This is required for per-guest ACK tracking. The payload is identical for all guests — only the targeting changed.

## Generalization (CAPS 06 → 07)
- `PendingDelivery` gained `messageType` field
- Map key changed from `playerId` to `deliveryKey(messageType, playerId)`
- `handleCardsDealtAck` → generic `handleDeliveryAck(messageType, senderId, data)`
- New `trackDelivery(messageType, playerId, handId, payload)` helper
- `scheduleRetry` now reads messageType from the pending entry
- Client added separate `lastCompletedHandId` dedup tracker

## Status
Both critical fire-and-forget messages (CARDS_DEALT + HAND_COMPLETE) are now ACK-protected. The pattern is ready for BOARD_REVEAL if needed.
