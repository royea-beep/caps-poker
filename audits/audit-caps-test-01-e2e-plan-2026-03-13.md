# Audit — VAMOS CAPS TEST 01: E2E Multiplayer Test Plan
**Date:** 2026-03-13

## Scope
Execution-ready end-to-end test plan for CAPS internet multiplayer, covering happy paths, failure paths, ACK/retry, disconnect, rejoin, seat consistency, and UX validation.

## Key Constants Reference
- SUBSCRIBE_TIMEOUT_MS: 10s (channel subscribe)
- HOST_PRESENCE_WAIT_MS: 3s (guest waits for host)
- HOST_PRESENCE_POLL_MS: 300ms (poll interval)
- DELIVERY_RETRY_INTERVAL_MS: 2s (ACK retry)
- DELIVERY_MAX_RETRIES: 5
- HOST_LOST_GRACE_MS: 5s (grace before firing onHostLost)
- WAITING_STATE_TIMEOUT_MS: 60s (waiting phase timeout)

## Test Matrix

### Priority 1 — Happy Path (must pass before anything else)

| ID | Scenario | Steps | Expected Result |
|----|----------|-------|-----------------|
| HP-01 | Host creates room | Open internet-host, wait for room code | 4-6 digit numeric code displayed, status "Waiting for players" |
| HP-02 | Guest joins room | Enter host's code on internet-join, tap JOIN | Status → "Connected", both devices show 2 players |
| HP-03 | Seat assignment | Both devices check player list | Host = seat 0, Guest = seat 1, names correct on both |
| HP-04 | Host starts game | Host taps START GAME | Both devices navigate to multiplayer-game, both have cards + boards |
| HP-05 | Card dealing | Verify cards on both devices | Each player has correct card count, boards show open cards + hidden count |
| HP-06 | Arrange + ready (guest first) | Guest fills boards, taps READY | Guest enters waiting phase, host still arranging |
| HP-07 | Arrange + ready (host) | Host fills boards, taps READY | Both in waiting → reveal sequence fires |
| HP-08 | Results shown | Both navigate to /results | Both see board outcomes, chip deltas, winner info |
| HP-09 | Next hand | Both tap NEXT HAND on results | New cards dealt, back to arranging phase |
| HP-10 | Timer auto-fill | Let timer expire without placing all cards | Remaining cards auto-placed, player auto-readied |

### Priority 2 — ACK/Retry Validation

| ID | Scenario | Steps | Expected Result |
|----|----------|-------|-----------------|
| ACK-01 | CARDS_DEALT delivery | Start game normally | Guest receives cards within 2s, no visible retry |
| ACK-02 | CARDS_DEALT retry | (Hard to simulate) — check logs for ACK received | Server log: "ACK received for CARDS_DEALT" |
| ACK-03 | HAND_COMPLETE delivery | Complete a hand normally | Guest receives results, navigates to /results |
| ACK-04 | Duplicate protection | (Observe logs) | No double-processing of same handId |

### Priority 3 — Disconnect Handling

| ID | Scenario | Steps | Expected Result |
|----|----------|-------|-----------------|
| DC-01 | Host leaves lobby | Host force-closes app while guest is in lobby | Guest sees "Host Left" alert within ~8s (5s grace + network) |
| DC-02 | Guest leaves lobby | Guest force-closes app while in lobby | Host sees player count decrease, can still start with remaining |
| DC-03 | Guest leaves mid-game | Guest force-closes during arranging | Host continues; guest auto-readied by server; hand completes |
| DC-04 | Host leaves mid-game | Host force-closes during arranging | Guest sees disconnect banner + "Host Disconnected" alert |
| DC-05 | Guest leaves during waiting | Guest force-closes after readying | Server auto-readied already; hand proceeds if all others ready |
| DC-06 | Waiting timeout (60s) | One player doesn't ready, other waits 60s | Alert: "Waiting Timed Out" with Keep Waiting / Leave / Rejoin |

### Priority 4 — Manual Rejoin

| ID | Scenario | Steps | Expected Result |
|----|----------|-------|-----------------|
| RJ-01 | Rejoin during arranging | Guest kills app → reopens → enters same code | Guest receives GAME_STATE_SNAPSHOT, re-enters game in arranging |
| RJ-02 | Rejoin during waiting (already ready) | Guest kills app after readying → reopens → enters code | Guest receives snapshot with alreadyReady=true, enters waiting phase |
| RJ-03 | Rejoin after hand complete | Guest kills app during results → reopens → enters code | Guest stays in lobby, waits for next CARDS_DEALT |
| RJ-04 | Rejoin prefilled code | Guest clicks "Rejoin" from disconnect alert | internet-join opens with room code pre-filled |
| RJ-05 | Stale snapshot rejected | Guest reconnects after handId has advanced | Old snapshot ignored if handId < lastProcessedHandId |
| RJ-06 | Seat preserved on rejoin | Guest reconnects | Same seat index, not reassigned to new seat |

### Priority 5 — Connect Safety

| ID | Scenario | Steps | Expected Result |
|----|----------|-------|-----------------|
| CS-01 | Invalid room code (short) | Enter "12" and try to join | JOIN button disabled (needs 4+ digits) |
| CS-02 | Invalid room code (letters) | Try entering "ABCD" | Input filters to digits only |
| CS-03 | Room doesn't exist | Enter valid format but unused code, tap JOIN | "Room Not Found" alert within ~3s |
| CS-04 | Host closed room before join | Host cancels while guest is typing code | Guest gets "Room Not Found" on join attempt |
| CS-05 | Network failure | Disconnect wifi/data before joining | Error state shown, "TRY AGAIN" button appears |

### Priority 6 — Seat Consistency

| ID | Scenario | Steps | Expected Result |
|----|----------|-------|-----------------|
| ST-01 | 2-player seats | Host + 1 guest | Host=0, Guest=1 — verified on both devices |
| ST-02 | 3-player seats | Host + 2 guests | Seats 0,1,2 — all three devices agree |
| ST-03 | ROOM_STATE broadcast | Guest joins | Guest receives authoritative seat map matching host's getClients() |
| ST-04 | Seat stable after rejoin | Guest disconnects and rejoins | Same seat number, no renumbering |

### Priority 7 — UX Validation

| ID | Scenario | Steps | Expected Result |
|----|----------|-------|-----------------|
| UX-01 | Host disconnect alert | Host leaves mid-game (guest perspective) | Alert: "Host Disconnected" / "The host has left the game." / [Leave] |
| UX-02 | Guest disconnect alert | Connection drops (guest perspective) | Alert: "Connection Lost" with [Leave] + [Rejoin] options |
| UX-03 | Waiting timeout alert | 60s in waiting phase | Alert: "Waiting Timed Out" with [Keep Waiting] / [Leave] / [Rejoin] |
| UX-04 | Disconnect banner | Any disconnect event | Yellow/red banner visible at top of game screen |
| UX-05 | No trapped states | After any alert, user can navigate home or rejoin | Verify no blank screens, no infinite loading |
| UX-06 | Lobby error recovery | "Room Not Found" → tap TRY AGAIN | Returns to idle state, can re-enter code |

## Fastest High-Value Test Order

Run these 8 tests first for maximum confidence with minimum time:

1. **HP-01 + HP-02 + HP-03** — Room creation, join, seats (validates basic connectivity)
2. **HP-04 + HP-05** — Game start + dealing (validates CARDS_DEALT delivery)
3. **HP-06 + HP-07 + HP-08** — Full hand cycle (validates ready/reveal/results)
4. **DC-03** — Guest disconnect mid-game (validates auto-ready + game doesn't hang)
5. **RJ-01** — Rejoin during arranging (validates GAME_STATE_SNAPSHOT + reconnect)
6. **DC-01** — Host disconnect in lobby (validates host-loss detection)
7. **HP-09** — Next hand (validates multi-hand session)
8. **CS-03** — Room not found (validates connect safety)

If these 8 pass, the system is fundamentally working.

## Highest-Risk Areas

| Risk | Why | Impact if Broken |
|------|-----|-----------------|
| **CARDS_DEALT not arriving** | Depends on Supabase broadcast reliability + ACK/retry timing | Game cannot start — complete blocker |
| **Host presence detection** | Supabase presence sync can be delayed or unreliable | False host-loss alerts, game crashes |
| **Rejoin snapshot timing** | Server must detect reconnect via presence → send snapshot before client navigates away | Guest stuck in lobby or gets stale state |
| **Auto-ready for disconnected players** | Server must correctly mark disconnected guest as ready | Game hangs forever waiting for dead player |
| **HAND_COMPLETE delivery** | Must arrive reliably; retry depends on guest still being subscribed | Results screen never reached, game stuck |

## Test Environment Recommendations

### Minimum Setup
- **2 devices** (or 1 device + 1 web browser)
- Both on same Supabase project (production or staging)
- Internet connection (not localhost)

### Recommended Combinations (Priority Order)
1. **iOS device + Web browser** — fastest to iterate, covers cross-platform
2. **iOS device + Android device** — real mobile-to-mobile validation
3. **2 Web browser tabs** — quickest smoke test (Expo web)
4. **3 devices** — for 3+ player seat testing (ST-02)

### Network Conditions
1. **Normal WiFi** — baseline happy path
2. **4G/LTE mobile data** — realistic latency
3. **Simulated poor network** — use browser dev tools to throttle (for retry/timeout testing)
4. **Airplane mode toggle** — for disconnect/rejoin testing (easiest way to force disconnects)

### How to Simulate Disconnects
- **Guest disconnect:** Toggle airplane mode on guest device
- **Host disconnect:** Force-close host app (or toggle airplane mode)
- **Network degradation:** Browser DevTools → Network → Slow 3G
- **Channel error:** Cannot easily simulate — rely on real network drops

## Pass/Fail Criteria

### PASS — Good Enough to Move Forward
- All Priority 1 (HP-01 through HP-10) pass
- DC-03 passes (guest disconnect doesn't hang game)
- DC-01 passes (host loss detected)
- RJ-01 passes (basic rejoin works)
- CS-03 passes (invalid room handled)
- No data corruption (cards, seats, chips consistent across devices)

### FAIL — Blocks Release
- CARDS_DEALT never arrives on guest (even after retries)
- Game hangs permanently when a player disconnects
- Host-loss detection never fires (guest trapped)
- Rejoin causes duplicate cards or wrong seat
- Chip amounts differ between host and guest after same hand
- App crashes on any standard multiplayer flow
- Any "trapped state" where user cannot escape back to home

### ACCEPTABLE ISSUES (Fix Later)
- BOARD_REVEAL occasionally missed (display-only, doesn't block game)
- Disconnect banner briefly appears then disappears (timing edge case)
- Rejoin takes >5 seconds (slow but functional)
- 3-4 player games have minor seat display issues (2-player is primary)
