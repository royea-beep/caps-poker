# Audit — VAMOS CAPS 05: Internet Multiplayer E2E Test Plan + Hardening Audit
**Date:** 2026-03-13

## Scope
End-to-end test plan and hardening audit for the internet multiplayer system repaired in CAPS 04. Checked 15 specific areas: room creation, room join, presence sync, seat assignment, game start, card delivery, ready flow, reveal flow, hand complete, next hand, disconnect/reconnect, duplicate messages, dropped messages, Supabase assumptions, ACK/retry needs.

## 15-Area Analysis

### 1. Room Creation Flow
- Host creates RealtimeServer, generates 6-char code, calls server.start()
- server.start() subscribes to Supabase channel, tracks presence, adds host as seat 0
- **Issue:** No uniqueness check on room code (acceptable — 1 in 500M collision probability)
- **Issue:** No timeout if subscribe hangs

### 2. Room Join Flow
- Guest creates RealtimeClient, calls client.connect(code, name)
- **CRITICAL:** connect() returns true immediately at line 495 regardless of actual subscription success
- No validation that the room exists or host is present
- Guest could sit on a dead channel indefinitely

### 3. Presence Sync
- Both sides use Supabase presence with channel.track()
- Server: syncClientsFromPresence updates internal clients Map
- **Issue:** Object.entries(presenceState()) has no guaranteed order
- **Issue:** Presence is eventually consistent — brief stale windows possible

### 4. Seat Assignment Consistency
- Server: host=seat 0, others via getNextSeat() (first gap in internal Map)
- Lobby: uses `p.map((pl, idx) => ({...seat: idx...}))` — array index
- **HIGH:** These are independent calculations that can diverge after disconnect/reconnect
- Guest navigates with `playerIndex` from lobby, not from server's authoritative seat

### 5. Game Start Flow
- Host calls server.startGame(config) → deals → broadcasts CARDS_DEALT per guest
- Also broadcasts GAME_START (nobody listens for it)
- Host reads getDealtCards() and navigates immediately
- **Issue:** No confirmation that guests received cards before host navigates

### 6. Card Delivery
- Host reads via getDealtCards() (local, reliable)
- Guest receives via broadcast with targetId filter
- sendToPlayer uses broadcast — ALL clients receive, client filters by targetId
- **CRITICAL:** Fire-and-forget. Dropped message = guest stuck forever

### 7. Ready Flow
- Host: setHostReady(assignments) → marks ready, checks all ready
- Guest: sendReady(assignments) → broadcasts PLAYER_READY
- Server: handleIncomingMessage → marks client ready → checkAllReady
- checkAllReady filters to connected clients only
- **Issue:** Disconnect mid-ready could trigger premature all-ready if remaining are ready

### 8. Reveal Flow
- Host: onAllPlayersReady → runRevealSequence → sendBoardReveal × N → sendHandComplete
- Guest: onBoardReveal stores in Map; onHandComplete triggers navigation
- **HIGH:** All messages sent in tight synchronous loop — no delay, no sequencing
- **Issue:** If HAND_COMPLETE arrives before all BOARD_REVEALs, fallback empty data used

### 9. Hand Complete Flow
- Host builds HandCompletePayload, broadcasts
- Guest builds RevealData from stored board reveals + this payload
- Both navigate to /results
- **Issue:** No guard against double-receive of HAND_COMPLETE (would trigger double navigation)

### 10. Next Hand Flow
- Host: sets onNewHandDealt callback → requestNextHand(config)
- Guest: sets onCardsDealt callback → sendNextHandRequest()
- Server: tracks in Set, checks if all connected requested → startNewHand
- **Issue:** Guest seat from connectedPlayers store (results.tsx:170) may be stale

### 11. Disconnect / Reconnect
- syncClientsFromPresence marks absent clients as connected=false
- **CRITICAL:** No reconnection logic whatsoever
- No way for a disconnected player to rejoin mid-game
- If host disconnects, game is completely dead for all guests

### 12. Duplicate Message Risks
- No message IDs or deduplication
- PLAYER_READY: idempotent (re-marks ready, same assignments)
- NEXT_HAND_REQUEST: Set-based (naturally deduped)
- BOARD_REVEAL: Map-based by boardIndex (naturally deduped)
- HAND_COMPLETE: triggers navigation — double receive is problematic
- ALL_READY: host fires callback directly (not received via broadcast)

### 13. Dropped Message Risks
- CARDS_DEALT dropped → guest stuck forever on "Waiting for host"
- BOARD_REVEAL dropped → guest has partial/empty reveal data
- HAND_COMPLETE dropped → guest stuck on waiting overlay
- ALL_READY dropped → guest stuck on "Waiting for other players" (host fires directly)
- PLAYER_READY dropped → server never marks player ready → all stuck

### 14. Supabase Realtime Assumptions
- Broadcast: fire-and-forget, no delivery guarantee, self-receives
- Presence: eventually consistent, no ordering guarantee
- Rate limits: ~100 msg/s (tight BOARD_REVEAL loop could approach this)
- Channel subscribe: async, not instant
- No message persistence — missed messages are gone forever

### 15. ACK/Retry Needs
- **YES** — at minimum for CARDS_DEALT and HAND_COMPLETE
- PLAYER_READY loss is recoverable (user can re-tap READY)
- BOARD_REVEAL loss degrades display but doesn't break flow
- Recommended pattern: receiver sends ACK, sender retries every 2s up to 5x

## Hardening Gaps Summary
| # | Gap | Severity |
|---|-----|----------|
| 1 | No message ACK/retry | CRITICAL |
| 2 | No reconnection logic | CRITICAL |
| 3 | connect() doesn't validate room | HIGH |
| 4 | No senderId filter on server | HIGH |
| 5 | No stale-player cleanup | HIGH |
| 6 | No host-death detection | HIGH |
| 7 | Seat sync divergence | HIGH |
| 8 | No message ordering/sequencing | MEDIUM |
| 9 | No duplicate guard for HAND_COMPLETE | MEDIUM |
| 10 | No rate-limit awareness | MEDIUM |
| 11 | Guest seat from stale store | MEDIUM |
| 12 | No leave notification | LOW |

## Recommended Implementation Order
1. ACK + retry for CARDS_DEALT
2. Validate room exists on join (JOIN_ACK handshake)
3. Self-message filter on server
4. Unify seat assignment (server as single source)
5. ACK + retry for HAND_COMPLETE
6. Timeout on waiting states (60s with escape)
7. Host-alive detection
8. Sequence numbers on broadcasts
9. Leave notification
10. Reconnection logic

## Risk Assessment
- **WiFi path:** Zero impact — this audit is internet-only
- **Internet path:** Functional but fragile — 2 critical, 4 high gaps identified
- **Recommended:** Implement steps 1-4 before real user testing
