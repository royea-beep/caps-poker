# VAMOS MEGA PROMPT — Reveal & Results Screens Overhaul
**Version:** v1.9.4 | **Build:** b113 | **Date:** 2026-03-20 23:40 IL (UTC+2)

---

## ROLE
You are a **Senior UI Engineer** who MISSED the reveal and results screens in the last sprint. Fix that NOW. No excuses.

## FIRST ACTIONS
```
Read C:/Users/royea/.claude/projects/C--Projects-Caps/memory/MEMORY.md
Iron Rules confirmed.
cp this file to docs/prompts/

# CRITICAL — read ALL screen files first
cat app/results.tsx
cat components/RevealSequence.tsx
cat components/CompleteOverlay.tsx
```

---

## WHAT'S BROKEN (from 3 screenshots)

### Screenshot 1 — Reveal Screen (Board 1 of 4)
**Problems:**
1. Community cards (FLOP) on the LEFT side in a vertical column — should be CENTERED horizontally, or at least more prominent
2. Player cards (YOU/BOT) are left-aligned — should be centered
3. Massive empty space on the right — terrible use of screen width
4. "BOT WINS" at the bottom — fine but could be more styled
5. "TAP TO CONTINUE →" — fine
6. "SKIP" button top-right — fine
7. Overall layout is LEFT-HEAVY — everything hugs the left side on web

**Fix:** Center the entire reveal layout. Community cards should be a horizontal row at the top/center. Player and bot hands below, centered. Use the full width.

### Screenshot 2 — Reveal Screen (during countdown "1")
**Same problems as above** plus:
- The countdown number "1" is at the bottom — should be more prominent, centered
- "YOU 55%" and "BOT 45%" labels are fine but could be styled better
- The divider line between bot and player areas is good

### Screenshot 3 — Results Summary Screen
**Problems:**
1. Layout is decent but could be more polished
2. "BOARD 3 LOSS" and "BOARD 4 LOSS" badges look OK
3. Cards are displayed well with hand names (High Card, Two Pair) — good
4. "PLACEMENT EFFICIENCY 58%" section — looks OK
5. "Optimal arrangement" section — fine but basic
6. "COMPLETE BONUS! +50" — fine
7. **POST error in console:** `https://caps.ftable.co.il/api/learn` returns 405 — this endpoint doesn't exist. Fix or suppress.

---

## THE FIXES

### Fix 1 — Reveal Screen Layout (PRIORITY)
The reveal screen needs to be CENTERED, not left-aligned. On web (wide screens), the content should be centered with max-width.

```bash
# Find the reveal component
grep -rn "BOARD.*of\|FLOP\|RIVER\|TURN\|community\|reveal" components/RevealSequence.tsx | head -20
```

**Target layout for reveal (centered, like a poker table):**
```
[  BOARD 1 of 4                          SKIP  ]
[                                               ]
[           ── Community Cards ──               ]
[         [7♥] [3♥] [5♠] [?] [?]              ]
[                                               ]
[    ─────────── divider ───────────            ]
[                                               ]
[  BOT 45%                                      ]
[  [9♥] [4♥] [8♥] [K♠]    Straight             ]
[                                               ]
[    ─────────── divider ───────────            ]
[                                               ]
[  YOU 55%                                      ]
[  [7♣] [3♣] [4♦] [A♥]    High Card            ]
[                                               ]
[           [ BOT WINS ]                        ]
[         TAP TO CONTINUE →                     ]
```

Key changes:
- Community cards: **horizontal row, centered**, not vertical column on the left
- Bot and player hands: **centered blocks** with cards in a row
- Use flexbox centering, not left-alignment
- On web: add maxWidth container (600-800px) and center it
- The countdown number should be large and centered when it appears

### Fix 2 — Results Screen Polish
The results screen is mostly OK but needs:
- Theme-aware background (Five-O red, Classic dark)
- Board sections themed (borders, backgrounds match theme)
- WIN/LOSS badges styled to match the game screen badges

### Fix 3 — /api/learn 405 Error
Console shows `POST https://caps.ftable.co.il/api/learn` returning 405.

```bash
# Find where this is called
grep -rn "api/learn\|/learn" app/ components/ utils/ store/ --include="*.ts" --include="*.tsx" | head -10
```

Fix: Either create the endpoint, or wrap the call in try/catch to suppress the error.

---

## IMPORTANT
- Apply theme colors to BOTH reveal and results screens
- Test on web (wide screen) — content must be CENTERED, not left-aligned
- Test on mobile (narrow) — content must still fit
- Do NOT break the game screen (game.tsx) changes from b111-b113

---

## SUCCESS CRITERIA
- [ ] Reveal: community cards centered horizontally (not vertical left column)
- [ ] Reveal: player/bot hands centered
- [ ] Reveal: no massive empty space on right
- [ ] Reveal: countdown number prominent and centered
- [ ] Results: theme-aware backgrounds
- [ ] /api/learn error fixed or suppressed
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
git add -A && git commit -m "feat: reveal + results screens overhaul [v1.9.4-b114]" && git push
# Update MEMORY.md
```

---

*Fix autonomously. The reveal screen is the CLIMAX of the game — it should look amazing, not left-aligned garbage. Center everything. Make it dramatic.*
