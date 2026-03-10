# Caps Poker — QA Checklist (Pre-TestFlight)

## Core Game Flow
- [ ] App launches without crash
- [ ] Home screen shows chip balance
- [ ] "New Hand" starts a game
- [ ] 16 cards dealt to player hand
- [ ] Timer counts down from configured seconds
- [ ] Cards can be placed on boards (tap card → tap board)
- [ ] Cards can be removed from boards (tap remove button)
- [ ] Ready button appears when all 4 boards have 4 cards
- [ ] Bot places cards within configured time
- [ ] Reveal sequence runs board by board
- [ ] Winning hand cards are highlighted with glow
- [ ] Board shows pulsing gold border during reveal
- [ ] Summary screen shows correct results per board
- [ ] "Next Hand" starts a new hand
- [ ] "Home" returns to home screen
- [ ] Chip balance persists between app restarts

## COMPLETE Bonus
- [ ] COMPLETE overlay appears when one player wins all 4 boards
- [ ] Gold particle burst animation plays
- [ ] Bonus chips calculated correctly (50% of total pot by default)
- [ ] Overlay auto-dismisses after configured duration

## Settings
- [ ] All 8 parameters visible and editable
- [ ] Changes take effect in next hand
- [ ] Reset to defaults works
- [ ] Settings persist between app restarts

## Animations
- [ ] Button press has spring scale effect
- [ ] Card highlight has animated glow
- [ ] Active board has pulsing gold border
- [ ] COMPLETE overlay has spring entrance + particles

## Edge Cases
- [ ] Timer runs out → remaining slots auto-filled randomly
- [ ] Tie on a board → pot returned to each player
- [ ] 0 chips → can still start new hand (negative balance allowed)
- [ ] App backgrounded mid-game → returns without crash
- [ ] Rapid card placement → no duplicate cards on boards
