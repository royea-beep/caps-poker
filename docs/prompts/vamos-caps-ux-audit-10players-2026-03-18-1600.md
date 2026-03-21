VAMOS CAPS UX-AUDIT-10PLAYERS 2026-03-18-1600

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## MISSION
Simulate 10 real players testing the app on iPhone.
Find every UX problem, crash, and visual issue.
Fix everything in one sprint.

---

## TASK A — 10-player simulation audit
Agent: ux-auditor

Simulate 10 different user behaviors and find issues:

**Player 1 — Speed runner:** Taps READY immediately, doesn't wait
**Player 2 — Slow player:** Takes 25+ seconds to arrange cards
**Player 3 — Mis-tapper:** Taps wrong board, uses UNDO repeatedly
**Player 4 — Rotator:** Locks phone during game, comes back
**Player 5 — Navigator:** Presses X to exit mid-game
**Player 6 — Replayer:** Plays 5 hands in a row without closing app
**Player 7 — Low balance:** Gets to 0 chips
**Player 8 — 3-player game:** Uses tournament/sit-and-go mode
**Player 9 — First timer:** Opens app for first time, balance 500
**Player 10 — iOS notch:** iPhone with notch/Dynamic Island — UI cut off?

A1. Read app/game.tsx, app/results.tsx, app/index.tsx, components/RevealSequence.tsx in full
A2. For each player scenario — identify any UX or crash issue
A3. List ALL issues found

---

## TASK B — Fix reveal screen (CRITICAL)
Agent: reveal-fixer

Current state: reveal shows all boards on same screen, slow to start.

Required behavior:
- ONE board per screen, full height
- Swipe LEFT/RIGHT to go between boards (or tap to advance)
- Each board screen shows:
  * Top: "BOARD 1 / 4" + winner badge (YOU WIN / BOT WINS / TIE)
  * Middle: community cards (flop visible, turn+river revealed with animation)
  * Bottom: YOUR cards vs BOT cards side by side
  * Very bottom: "TAP TO CONTINUE →"
- After last board → results summary screen

B1. Read components/RevealSequence.tsx in full
B2. Read hooks/useRevealSequence.ts in full
B3. Implement the above — use FlatList with pagingEnabled for swipe between boards
    OR use simple state currentBoardIndex with tap-to-advance
B4. Make sure it works on iPhone screen (375-430px wide)
B5. Cards must be readable — use sizes: community 58×82, player 52×74

---

## TASK C — Fix iPhone UX issues
Agent: iphone-fixer

C1. Check safe area handling — does content hide under notch/home indicator?
    Read app/game.tsx and app/results.tsx
    Make sure SafeAreaView or useSafeAreaInsets is used everywhere

C2. Check touch targets — are all buttons at least 44×44px?
    READY button, UNDO button, card tap areas

C3. Check font sizes — are all text elements readable on small screens?
    Minimum 12px for any text, 16px for important text

C4. Fix the READY button — make it more prominent:
    Full width, gold, large text, clear visual feedback when tapped

C5. Timer — is it visible during bot wait phase?
    Should be large and centered, counting down clearly

---

## TASK D — Fix navigation stuck issue
Agent: nav-fixer

D1. The reveal is slow to start — investigate why
D2. Read the navigateToReveal flow in game.tsx
D3. Add a loading indicator between READY and reveal:
    When both ready → show "Calculating results..." spinner
    Then navigate when ready
D4. Make the transition feel fast and smooth

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — all pass
3. npx expo export --platform web
4. node scripts/fix-web-html.js
5. cd dist && vercel --prod --yes
6. git add -A && git commit -m "ux: 10-player audit fixes, reveal one board at a time, iPhone UX"
7. git push origin main
8. Update MEMORY.md
9. Report: full list of issues found + fixed, screenshot description of reveal screen

VAMOS CAPS UX-AUDIT-10PLAYERS — END
