# VAMOS MEGA PROMPT — Hand Evaluator Bug + X Button Fix
**Version:** v1.9.4 | **Build:** b115 | **Date:** 2026-03-21 03:00 IL (UTC+2)

---

## ROLE
You are a **Senior Poker Engine + UI Engineer**. Critical bugs.

## FIRST ACTIONS
```
Read C:/Users/royea/.claude/projects/C--Projects-Caps/memory/MEMORY.md
Iron Rules confirmed.
cp this file to docs/prompts/
```

---

## BUG 1 — Hand Evaluator Shows Wrong Hand Name (CRITICAL)

### Evidence from screenshot:
- **Bot cards:** 2♦, 7♥, 4♠, Q♥
- **Community:** 4♣, 7♦, A♥, 6♣, 4♦
- **Evaluator says:** Bot has "High Card"
- **Actual:** Bot should have **Full House** (4s full of 7s)

In Omaha: must use exactly 2 from hand + 3 from board.
Bot picks: 4♠ + 7♥ (hand) + 4♣ + 4♦ + 7♦ (board) = 4♠, 4♣, 4♦, 7♥, 7♦ = Full House.

**This is a game-breaking bug if the EVALUATOR itself is wrong** (not just the display). Check:
1. Does the evaluator compute the winner correctly? (Did the right player actually win?)
2. Or is it just the hand NAME display that's wrong?

### Investigation:
```bash
# Find the hand evaluator
find C:/Projects/Caps -name "*evaluat*" -o -name "*hand*" -o -name "*omaha*" | grep -v node_modules | head -20

# Find where hand names are generated
grep -rn "High Card\|Full House\|handName\|getHandName\|rankToName" utils/ --include="*.ts" | head -20

# Find the evaluation logic
cat utils/handEvaluator.ts
# or wherever it lives
```

**Test case to add:**
```typescript
// Bot: 2♦, 7♥, 4♠, Q♥
// Community: 4♣, 7♦, A♥, 6♣, 4♦
// Expected: Full House (4s full of 7s), NOT High Card
```

If the evaluator is actually returning the wrong winner (not just wrong name), this is an **Iron Rule 4 violation** — "Hand evaluation: full Omaha — exactly 2 player cards + 3 board cards."

### Fix:
Debug the evaluator step by step:
1. Generate all C(4,2) × C(5,3) = 6 × 10 = 60 combinations
2. For each combo, evaluate the 5-card hand
3. Return the best hand
4. Verify the hand name matches the rank

---

## BUG 2 — X Close Button Still Not Working on Web

The zIndex fix from b113 didn't fully resolve it. The X button in the game screen still doesn't respond to clicks on web.

### Deep investigation:
```bash
# Check if there's an overlay or invisible element blocking
grep -n "position.*absolute\|zIndex\|pointerEvents" app/game.tsx | head -30

# Check the X button specifically
grep -A5 "backButton\|handleBack" app/game.tsx | head -20
```

Possible causes:
1. Another absolute-positioned element is above the topBar (zIndex > 10)
2. The SafeAreaView or a parent container has overflow: hidden clipping the touch area
3. The Pressable hitSlop/size is too small on web
4. Web-specific: the button might need `cursor: pointer` and explicit click handler
5. The `handleBack` function might have a guard/condition that prevents navigation

### Fix approach:
- Add `cursor: 'pointer'` to backButton style on web
- Increase button size/hitSlop
- Add `console.log('X pressed')` to handleBack to verify the handler fires
- If handler fires but navigation doesn't work — it's a routing issue
- If handler doesn't fire — it's a touch/click blocking issue

### Test:
After fix, verify:
1. Click X on web → navigates back
2. Click X on iOS → navigates back
3. All other buttons still work

---

## SUCCESS CRITERIA
- [ ] Hand evaluator correctly evaluates all Omaha hands
- [ ] Hand NAME matches the actual hand rank
- [ ] Test case added for the Full House scenario
- [ ] X button works on web
- [ ] 115/115 tests pass (+ new test)
- [ ] Web deployed + git pushed

---

## ON COMPLETION
```bash
tsc --noEmit
npx jest --forceExit
npx expo export --platform web --clear
node scripts/fix-web-html.js
cd dist && vercel --prod --yes
git add -A && git commit -m "fix: hand evaluator bug + X button [v1.9.4-b116]" && git push
# Update MEMORY.md
```

---

*The hand evaluator bug is CRITICAL. If the evaluator is producing wrong winners, the entire game is broken. Investigate first, then fix.*
