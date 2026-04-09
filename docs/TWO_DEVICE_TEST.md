# CAPS Poker — 2-Device Test Checklist
## Setup
- Device A (Host): iPhone with TestFlight Build 338
- Device B (Guest): iPhone with TestFlight Build 338
- Both on same WiFi network

## LOCAL MP TEST
1. Device A: Lobby → Local → Host Game
2. Device A: Note the Room Code (4 digits)
3. Device B: Lobby → Local → Join Game → enter code
4. Expected: Both see "Game starting in 3..."
5. Play a full game
6. Verify: yourSeat correct (A=0, B=1)
7. Verify: Card placement syncs on both screens
8. Verify: Reveal shows same results on both
9. Test disconnect: turn off Device B WiFi mid-game
10. Expected: Device A sees "Player 2 disconnected"

## INTERNET MP TEST
1. Device A: Lobby → ⚡ Play Online → Host
2. Device A: Note the 6-char room code
3. Device B: Lobby → ⚡ Play Online → Join → enter code
4. Expected: Device A sees "Player joined"
5. Device A: Tap Start
6. Play full game
7. Verify: CARDS_DEALT correct per player
8. Verify: BOARD_REVEAL authoritative from host
9. Test: Device B goes offline mid-game
10. Expected: Device A sees banner "Player disconnected"

## RESULTS TO REPORT
- Local MP works: YES/NO
- Internet MP works: YES/NO
- Issues found: [list]
