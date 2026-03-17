# CAPS Fast-Confidence Test Execution Sheet
**Date:** 2026-03-13
**Version:** 1.0
**Devices:** ________ + ________
**Network:** ________
**Build:** Expo Dev / EAS / Web

---

## Pre-Flight Checklist

- [ ] Both devices can reach Supabase (open app, confirm no errors)
- [ ] Both devices have Expo dev server or built app running
- [ ] Player names set on both devices (Settings → Player Name)
- [ ] Chips balance is non-zero on both devices
- [ ] Keep console/logs visible if possible (Expo dev tools or browser DevTools)
- [ ] Have a timer or clock visible for timeout tests

---

## Test 1: Room Create + Join + Seats

**ID:** FC-01
**Setup:** Device A = Host, Device B = Guest. Both on home screen.
**Actions:**
1. Device A: Tap "PLAY ONLINE" → internet-host screen loads
2. Note the room code displayed: ________
3. Device B: Tap "JOIN GAME" → enter room code → tap JOIN
4. Wait for Device B to show "Connected"
5. Check both screens show 2 players

**Verify:**
- [ ] Room code is 4-6 digits, numeric only
- [ ] Device A shows 2 players in list
- [ ] Device B shows "Waiting for host to start..."
- [ ] Player names correct on both devices
- [ ] Device A shows itself + Device B's name
- [ ] Device B shows itself + Device A's name

**Result:** PASS / FAIL
**Notes:** ________

---

## Test 2: Game Start + CARDS_DEALT

**ID:** FC-02
**Setup:** Continuing from FC-01 (both in lobby, 2 players connected)
**Actions:**
1. Device A (host): Tap "START GAME"
2. Both devices should navigate to multiplayer-game screen

**Verify:**
- [ ] Device A sees cards in hand + boards with open cards
- [ ] Device B sees cards in hand + boards with open cards
- [ ] Card counts correct (16 cards each for 2-player, 4 boards)
- [ ] Timer is running on both devices
- [ ] Board open cards are identical on both devices
- [ ] No error alerts on either device

**Result:** PASS / FAIL
**Notes:** ________

---

## Test 3: Full Hand Cycle

**ID:** FC-03
**Setup:** Continuing from FC-02 (both in arranging phase)
**Actions:**
1. Device B (guest): Place all cards on boards (4 per board)
2. Device B: Tap READY → should enter waiting phase
3. Device A (host): Place all cards on boards
4. Device A: Tap READY → both should transition to results

**Verify:**
- [ ] Device B shows "Waiting..." after readying
- [ ] After both ready, both navigate to /results
- [ ] Board outcomes shown (winners per board)
- [ ] Chip delta displayed on both devices
- [ ] Chip deltas are consistent (zero-sum: if A wins X, B loses X)
- [ ] No error alerts

**Result:** PASS / FAIL
**Notes:** ________

---

## Test 4: Guest Disconnect Mid-Game

**ID:** FC-04
**Setup:** Start a new hand (from results, both tap NEXT HAND → new arranging phase)
**Actions:**
1. Both in arranging phase
2. Device B (guest): Toggle airplane mode ON (or force-close app)
3. Wait 10 seconds
4. Device A (host): Continue placing cards, tap READY

**Verify:**
- [ ] Device A does NOT freeze or hang
- [ ] Game proceeds — server auto-readied the disconnected guest
- [ ] Device A eventually navigates to /results
- [ ] Results show outcomes (disconnected guest's cards were auto-filled)
- [ ] No crash on Device A

**Result:** PASS / FAIL
**Notes:** ________

---

## Test 5: Rejoin During Arranging

**ID:** FC-05
**Setup:** Start a new hand. Both in arranging phase.
**Actions:**
1. Device B (guest): Toggle airplane mode ON
2. Wait 5 seconds
3. Device B: Toggle airplane mode OFF, reopen app if needed
4. Device B: Navigate to JOIN GAME
5. Check if room code is pre-filled (if coming from alert). If not, enter code manually.
6. Tap JOIN

**Verify:**
- [ ] Device B reconnects to room
- [ ] Device B receives GAME_STATE_SNAPSHOT
- [ ] Device B navigates to multiplayer-game with cards + boards
- [ ] Device B is in arranging phase (can place cards)
- [ ] Device B's seat is same as before (not renumbered)
- [ ] Device A sees Device B as connected again

**Result:** PASS / FAIL
**Notes:** ________

---

## Test 6: Host Disconnect in Lobby

**ID:** FC-06
**Setup:** Create a new room. Device A = host, Device B = guest, both in lobby.
**Actions:**
1. Device A (host): Force-close the app (or toggle airplane mode)
2. Wait up to 10 seconds on Device B

**Verify:**
- [ ] Device B sees "Host Left" or "Host Disconnected" alert within ~8 seconds
- [ ] Alert has a clear dismiss/leave action
- [ ] After dismissing, Device B can navigate home (not trapped)
- [ ] No crash on Device B

**Result:** PASS / FAIL
**Notes:** ________

---

## Test 7: Next Hand Flow

**ID:** FC-07
**Setup:** Complete a hand normally (both through results screen)
**Actions:**
1. Device A (host) on results: Tap "NEXT HAND"
2. Device B (guest) on results: Tap "NEXT HAND"
3. Wait for new hand to be dealt

**Verify:**
- [ ] Both devices receive new cards
- [ ] Both navigate to multiplayer-game again
- [ ] New cards are different from previous hand
- [ ] Boards are fresh (new open cards)
- [ ] Timer restarted
- [ ] No error alerts

**Result:** PASS / FAIL
**Notes:** ________

---

## Test 8: Invalid Room Handling

**ID:** FC-08
**Setup:** Device B on home screen (no active room)
**Actions:**
1. Device B: Navigate to JOIN GAME
2. Enter "9999" (valid format but nonexistent room)
3. Tap JOIN
4. Wait for result

**Verify:**
- [ ] "Room Not Found" alert appears within ~5 seconds
- [ ] Alert text is clear: mentions checking code / host being online
- [ ] After dismissing, "TRY AGAIN" button appears
- [ ] Can re-enter a different code and try again
- [ ] No crash, no trapped state

**Also test:**
- [ ] Entering "12" (too short): JOIN button is disabled
- [ ] Typing letters: input strips to digits only

**Result:** PASS / FAIL
**Notes:** ________

---

## Results Summary

| Test | ID | Result | Blocker? | Notes |
|------|----|--------|----------|-------|
| Room create/join/seats | FC-01 | | | |
| Game start + CARDS_DEALT | FC-02 | | | |
| Full hand cycle | FC-03 | | | |
| Guest disconnect mid-game | FC-04 | | | |
| Rejoin during arranging | FC-05 | | | |
| Host disconnect in lobby | FC-06 | | | |
| Next hand flow | FC-07 | | | |
| Invalid room handling | FC-08 | | | |

**Overall:** ___/8 PASSED
**Blockers found:** ________
**Session duration:** ________
**Tester:** ________
