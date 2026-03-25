# VAMOS MEGA PROMPT — Button QA + Visual Fixes (b111 Followup)
**Version:** v1.9.4 | **Build:** b111 | **Date:** 2026-03-20 23:00 IL (UTC+2)

---

## ROLE
You are a **Senior QA + UI Engineer**. You test EVERY interactive element and fix what's broken.

## FIRST ACTIONS
```
Read C:/Users/royea/.claude/projects/C--Projects-Caps/memory/MEMORY.md
Iron Rules confirmed.
cp this file to docs/prompts/
```

---

## TASK 1 — Full Interactive Element QA

Test every button, tap target, and interactive element in the app. For EACH one, verify:
- It renders correctly
- It responds to press/tap
- It performs the expected action
- It has visual feedback (press state, animation, color change)

### Buttons & interactions to verify:

```bash
# Find all Pressable, TouchableOpacity, Button components
grep -rn "Pressable\|TouchableOpacity\|onPress" app/game.tsx components/ --include="*.tsx" | grep -v "//" | head -40
```

#### Game Screen (game.tsx):
1. **X (close) button** — should navigate back to home/menu
2. **⚡ AUTO button** (per board) — should auto-fill remaining slots on that board with random cards from hand
3. **Card in hand** — tap should select it (highlight/elevate)
4. **Empty slot on board** — tap should place selected card there
5. **Placed card on board** — tap should return it to hand (undo single card)
6. **UNDO button** — should undo last placement
7. **"16 left" / PLACE button** — when all boards full, should become PLACE/READY button. Verify it triggers the ready state.
8. **Three dots "..." menu** — should open settings or menu
9. **Timer** — verify countdown works and triggers reveal when it hits 0

#### Settings Screen:
10. **Theme picker** (Classic / Five-O) — should switch themes instantly
11. **Orientation picker** — should switch between portrait/landscape
12. **All settings toggles** — verify each one works

#### Home/Index Screen:
13. **Play button** — should start a new game
14. **Settings button** — should navigate to settings
15. **Any other navigation** — verify all links work

### How to test:
```bash
# Start the web dev server if not running
npx expo start --web --port 8081 &

# Then manually verify in browser — or check the code for onPress handlers
grep -n "onPress=" app/game.tsx | head -30
```

For each button, verify the `onPress` handler exists and is wired correctly. If any button is missing an onPress handler or the handler is broken, FIX IT.

---

## TASK 2 — Visual Issues from Screenshot

### 2.1 Background Color — Verify Five-O Theme
The screenshot shows a **dark green/charcoal background** — this looks like Classic, not Five-O. Check:
```bash
# Is the radial gradient being applied correctly?
grep -n "radial-gradient\|background:" app/game.tsx | head -10
```
Verify:
- Five-O should show radial gradient: center #5A1520 → edges #1C0508
- Classic should show COLORS.background (dark charcoal)
- The theme switching actually changes the background

### 2.2 "16 left" Bar at Bottom
The bottom bar shows "UNDO" + "16 left". Verify:
- "16 left" should become "PLACE" or "READY" when all 16 cards are placed (4 per board × 4 boards)
- The button should be pressable and trigger the game flow
- Visual: make the PLACE button prominent (gold/green) when active

### 2.3 Timer Not Visible
In the screenshot, the timer is not visible. Check:
- Is the timer rendered in portrait layout?
- Does it appear during countdown phase?
- Verify the new conic-gradient timer renders correctly

### 2.4 Bot "..." Status
Bot shows "..." (thinking). Verify:
- "..." changes to "✓ READY" when bot finishes arranging
- The yellow/green pill colors are correct

---

## TASK 3 — Additional Polish from Audit

### 3.1 Timer Color Transitions
Add timer color transitions based on time remaining:
```typescript
const timerColor = countdown > 20 ? '#28A745' :  // green
                   countdown > 10 ? '#FFC107' :  // yellow  
                   '#DC3545';                      // red
```
Verify this is already implemented. If not, add it.

### 3.2 Card Selection Visual Feedback
When a card in hand is tapped/selected:
- It should scale up slightly (1.05x)
- Add a glow/border highlight
- Other cards should dim slightly

Verify this works. If the press feedback is missing, add it.

### 3.3 Board Full Visual Feedback
When all 4 cards are placed on a board:
- Board should get a green glow/pulse
- The "board full" state should be obvious

Verify this works.

---

## SUCCESS CRITERIA
- [ ] EVERY button/pressable responds correctly
- [ ] Five-O theme shows red background (not green/charcoal)
- [ ] Timer renders and counts down in portrait web layout
- [ ] Auto button fills board correctly
- [ ] UNDO works
- [ ] PLACE/READY button works when boards full
- [ ] Card selection works (tap card → tap slot → card placed)
- [ ] Theme switching works
- [ ] 115/115 tests | TS: 0 errors
- [ ] Web deployed + git pushed

---

## ON COMPLETION
```bash
tsc --noEmit
npx jest --forceExit
npx expo export --platform web --clear
node scripts/fix-web-html.js
cd dist && vercel --prod --yes
git add -A && git commit -m "fix: button QA + visual fixes [v1.9.4-b112]" && git push
# Update MEMORY.md
```

---

*Test EVERYTHING. If a button doesn't work, fix it. If a visual is wrong, fix it. No broken interactions allowed.*
