# Checkpoint — VAMOS CAPS 11: Reconnection Strategy Audit + Safe Rejoin Plan
**Date:** 2026-03-13

## Summary
Design audit for reconnection strategy. No code changes. Analyzed identity system, server state persistence, seat stability, presence behavior, and all game phases. Defined "Manual Rejoin with Server Catch-Up" as the recommended model. Created 7-step implementation plan.

## Key Findings
- Device ID is persistent and stable (AsyncStorage). Same player = same ID.
- Server client map already persists disconnected entries (connected: false). Seat preserved on reconnect.
- Supabase presence merges on re-track with same key. No duplication.
- CARDS_DEALT/HAND_COMPLETE retry window is 10s. Beyond that, game state is lost for the guest.
- Server holds all data needed to rebuild a GAME_STATE_SNAPSHOT: boards, playerHands, handId, gameConfig.
- Host reconnection is NOT feasible without server-side state persistence.

## Recommended Model
Manual rejoin (guest re-enters room code) + server sends GAME_STATE_SNAPSHOT on reconnect detection. Covers lobby, arranging, and waiting phases. Reveal phase: guest waits for next hand.

## Implementation Plan (7 steps)
1. Server: game phase tracking
2. Server: GAME_STATE_SNAPSHOT method
3. Server: trigger snapshot on reconnect
4. Client: handle snapshot message
5. Guest lobby: navigate on snapshot
6. Disconnect alerts: add "Rejoin" option
7. Test all 6 scenarios

## Status
Audit complete. Ready for implementation in CAPS 12.
