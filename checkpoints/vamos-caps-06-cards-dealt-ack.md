# Checkpoint — VAMOS CAPS 06: ACK + Retry for CARDS_DEALT
**Date:** 2026-03-13

## Summary
Added acknowledgment and bounded retry protection for CARDS_DEALT messages in internet multiplayer. Prevents the #1 permanent-stuck scenario where a guest never receives their cards.

## Files Changed
| File | Action |
|------|--------|
| `utils/realtimeMultiplayer.ts` | Added delivery tracking, ACK handler, retry logic (server); dedup + ACK send (client); self-message filter; structured logging |

## Protocol
- Server sends CARDS_DEALT with `handId` field
- Client immediately sends CARDS_DEALT_ACK with matching `handId`
- Server retries every 2s up to 5 times if no ACK received
- Server fires onError callback after max retries exhausted
- Client deduplicates by `handId` (always ACKs, only processes once)
- All pending deliveries cleared on new hand or server stop

## Zero Changes
- No lobby screen changes
- No game screen changes
- No results screen changes
- No networkConfig.ts changes (handId is a runtime field, not a typed payload change)

## Status
CARDS_DEALT delivery is now protected. Pattern is reusable for BOARD_REVEAL / HAND_COMPLETE.
