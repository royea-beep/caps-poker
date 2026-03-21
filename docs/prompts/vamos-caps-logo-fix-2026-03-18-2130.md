VAMOS CAPS LOGO-FIX 2026-03-18-2130

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## PROBLEMS (from screenshots)
1. "CAPS POKER" title too big — breaks to 2 lines, pushes everything down
2. Background circle behind title is ugly and messy
3. BugReporter icon covers "16 left" button
4. Hand cards slightly too wide on native — overflow edge

---

## TASK A — Fix home screen logo
Agent: logo-fixer

A1. Read app/index.tsx in full

A2. Fix CAPS POKER title:
    - Must fit on ONE line: fontSize 42, letterSpacing 6, fontWeight '900'
    - Remove the circular background shape entirely — delete it
    - Keep the 4 suit icons (♠ ♥ ♦ ♣) above the title but smaller: fontSize 16, spaced evenly
    - Title stays center-aligned
    - Below title: tagline "Outsmart the Board. Win Every Round." fontSize 12

A3. Add debug info in small text at bottom (temporary, for testing):
    Show: theme name, button style, screen dimensions
    Color: rgba(255,255,255,0.2) — barely visible
    Position: above version badge

---

## TASK B — Fix BugReporter position
Agent: bug-reporter-fixer

B1. Read components/BugReporter.tsx in full
B2. The FAB icon is covering the "16 left" button in game screen
    Fix: in game.tsx, the FAB should not render during active game
    Check if there's a way to hide BugReporter when game is active
    Option 1: pass a prop `hidden={gamePhase !== 'idle'}` to BugReporter
    Option 2: move it to index.tsx only (not in _layout.tsx)
B3. On home screen: position bottom: safeArea.bottom + 60 (above Reset Chips button)

---

## TASK C — Fix hand cards overflow
Agent: hand-fixer

C1. Read components/PlayerHand.tsx in full
C2. Cards overflowing edge on native — fix:
    const cardW = Platform.OS === 'web'
      ? Math.min(72, Math.max(56, maxCardW))
      : Math.min(36, Math.max(28, maxCardW));  // smaller to ensure 8 per row
C3. Add paddingHorizontal: 4 to each card wrapper to prevent edge touching

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — all pass
3. npx expo export --platform web
4. node scripts/fix-web-html.js
5. cd dist && vercel --prod --yes
6. git add -A && git commit -m "fix: logo one line, remove circle, bug reporter position, hand cards"
7. git push origin main
8. Report done

VAMOS CAPS LOGO-FIX — END
