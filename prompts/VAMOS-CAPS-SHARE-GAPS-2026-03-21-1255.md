# VAMOS CAPS SHARE-GAPS
**Date:** 2026-03-21 12:55 IST
**Priority:** Close 2 missing items from Hand Share feature

## FIRST ACTIONS
```
Read C:\Projects\Caps\MEMORY.md
Read C:\Projects\Caps\components\ShareCard.tsx
Read C:\Projects\Caps\utils\shareHand.ts
Read C:\Projects\Caps\app\results.tsx
Read C:\Projects\Caps\app\hand-history.tsx
```

═══════════════════════════════════════════════════════════
GAP 1 — Instagram Story Format (1080×1920)
═══════════════════════════════════════════════════════════

Create `StoryShareCard` component in `components/ShareCard.tsx` (or separate file).

**Dimensions:** 1080×1920 (9:16 ratio for Instagram Stories)

**Layout — vertical, spacious:**
```
┌──────────────────────────┐
│                          │ ← 120px top padding
│     ♠ CAPS POKER ♦       │ ← gold logo, large (fontSize 48)
│                          │
│     ━━━━━━━━━━━━━━━      │ ← gold divider
│                          │
│     Community Cards      │
│  [3♥] [Q♠] [9♠] [7♦] [2♣]  │ ← large cards (width 100+)
│                          │
│     Your Hand            │
│  [A♠] [K♥] [J♦] [10♣]  │
│     FULL HOUSE           │ ← gold, fontSize 28
│                          │
│     Opponent             │
│  [8♣] [5♦] [3♠] [2♥]   │
│     TWO PAIR             │ ← dim
│                          │
│  ══════════════════════  │
│    ✅ YOU WIN  +150      │ ← large result
│  ══════════════════════  │
│                          │
│  🏆 COMPLETE! +50% BONUS│ ← if applicable, gold
│                          │
│  "Ship it."              │
│     — Phil Ivey 🃏       │ ← pro quote
│                          │
│  ┌──────────────────┐    │
│  │ Play CAPS Poker  │    │ ← CTA button visual
│  │ caps.ftable.co.il│    │
│  └──────────────────┘    │
│                          │ ← 80px bottom padding
└──────────────────────────┘
```

**Style:**
- Background: solid `#080c14` (no gradient — ViewShot sometimes fails with gradients)
- Cards larger than regular share card: width 90, height 126
- More vertical spacing between sections (40px gaps)
- CTA "button" at bottom: gold border pill, "Play CAPS Poker" text, URL below
- Everything centered

**Full game variant:**
Same 1080×1920 but compact board rows:
```
B1: [5 cards] FULL HOUSE    ✅ +150
B2: [5 cards] TWO PAIR      ❌ -100
B3: [5 cards] FLUSH         ✅ +200
B4: [5 cards] HIGH CARD     ❌ -50

NET: +200  ·  3/4 boards  ·  🏆 COMPLETE
```

**Integration:**
In `app/results.tsx`, add a second share option:
```
📸 Share Board     ← existing (regular share card)
📸 Share as Story  ← NEW (Instagram story format)
```

Or: single share button → show action sheet:
```
Share Image (WhatsApp/iMessage)
Share as Story (Instagram)
Copy Replay Link
Cancel
```

Use `ActionSheetIOS` or a custom bottom sheet.

═══════════════════════════════════════════════════════════
GAP 2 — Hand History Share
═══════════════════════════════════════════════════════════

**Read the hand history screen:**
```
cat C:\Projects\Caps\app\hand-history.tsx
Read C:\Projects\Caps\utils\handHistory.ts
```

**Add share button to each hand in history:**

Each hand entry in the list should have a small 📸 share icon/button.

When tapped:
1. Load the hand data from handHistory storage
2. Build a ShareData object from it (same format as results screen uses)
3. Render offscreen ShareCard (reuse SingleBoardShareCard or FullGameShareCard)
4. Capture with ViewShot
5. Open share sheet

**If hand-history.tsx shows individual hands:**
- Add 📸 icon button to each hand row (right side)
- On tap: share that specific hand

**If hand-history.tsx shows a list of games:**
- Add 📸 icon to each game entry
- On tap: share the full game summary

**Data check:**
The hand history must store enough data to reconstruct the share card:
- Community cards per board
- Player cards per board
- Opponent cards per board (if available — bot hands might not be stored)
- Hand names
- Win/loss per board
- Chip amounts

```
grep -n "community\|player.*card\|bot.*card\|opponent\|handName\|winner\|pot\|chips" C:\Projects\Caps\utils\handHistory.ts
```

If opponent cards aren't stored in history → store them going forward.
For existing history entries without opponent cards → show share card without opponent hand (just player hand + result).

═══════════════════════════════════════════════════════════
DEPLOY
═══════════════════════════════════════════════════════════

```
F1. npx tsc --noEmit — 0 errors
F2. npx jest --forceExit — 126+ pass
F3. npx expo export --platform web --output-dir web-dist
F4. node scripts/fix-web-html.js
F5. cd web-dist && vercel --prod --yes
F6. git add -A && git commit -m "feat: Instagram story share (1080x1920) + hand history share button"
F7. git push origin main
F8. Update MEMORY.md
```

## PROOF REQUIRED
```
═══════════════════════════════════════
SHARE GAPS — VERIFIED
═══════════════════════════════════════
GAP 1 — Instagram Story:
  StoryShareCard component: [YES + file + lines / NO]
  Dimensions 1080×1920: [YES / NO]
  CTA at bottom: [YES / NO]
  Action sheet or second button: [YES + lines / NO]

GAP 2 — Hand History Share:
  Share button in hand-history: [YES + lines / NO]
  Reuses ShareCard: [YES / NO]
  Opponent cards stored: [YES / NO / partial]
═══════════════════════════════════════
```

## DO NOT
- Do NOT change existing share card design
- Do NOT remove any existing share functionality
- Do NOT break hand history functionality

VAMOS CAPS SHARE-GAPS — END
