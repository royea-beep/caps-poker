# VAMOS CAPS CARD-SIZING-FIX
**Date:** 2026-03-23 22:00 IST
**Priority:** 🟡 Cards too big on some devices — hiding AUTO button

## PROBLEM
On some screen sizes, player cards on boards are so big they cover the AUTO button.
AUTO button = "⚡ AUTO" that auto-fills a board with cards from hand.
Users can't see or tap it.

## READ FIRST
```
cd C:\Projects\Caps
Read MEMORY.md
cat components/Board.tsx
cat app/game.tsx
cat utils/responsive.ts
```

## STEP 1 — Find where AUTO button is positioned

```bash
echo "=== AUTO button location ==="
grep -n "AUTO\|auto.*fill\|autoFill\|handleAutoFill" components/Board.tsx app/game.tsx | head -20

echo ""
echo "=== Card sizing on boards ==="
grep -n "cardWidth\|cardHeight\|CARD_W\|getCardDimensions\|commCardW\|playerCardW" \
  components/Board.tsx app/game.tsx utils/responsive.ts | head -30

echo ""
echo "=== Board layout ==="
grep -n "boardHeight\|boardWidth\|getBoardLayout\|board.*style\|board.*container" \
  components/Board.tsx app/game.tsx | head -20
```

## STEP 2 — Calculate correct card sizes

The math must guarantee:
```
Board width = screenWidth - horizontal padding
Community cards (5): each = floor((boardWidth - 4*gap) / 5)
Player cards on board (4): each = floor((boardWidth - 3*gap) / 4)

Board height must fit:
- Board label ("Board 1") 
- Community cards row
- Player cards row
- AUTO button ← THIS MUST BE VISIBLE
- All within the vertical space per board

4 boards must fit between:
- Header (top)
- Player hand area (bottom)

Available height = screenHeight - headerH - handAreaH - safeAreas
Board height = floor(availableHeight / numBoards)
```

## STEP 3 — Fix: reduce card sizes + ensure AUTO visible

```typescript
// The key constraint: AUTO button must be visible BELOW the player cards on each board.
// If cards are too tall → they push AUTO off the board → invisible.

// Fix approach:
// 1. Calculate max board height = available / numBoards
// 2. Within each board: label + community row + player row + AUTO button + padding
// 3. Card height = (boardHeight - labelH - autoButtonH - padding) / 2 rows
// 4. Card width = cardHeight / 1.4

// This guarantees AUTO is always visible because we SUBTRACT its space first.

const AUTO_BUTTON_H = rb(24); // minimum AUTO button height
const BOARD_LABEL_H = rh(18);
const BOARD_PAD = rs(8); // top + bottom padding

function getMaxCardHeight(boardHeight: number): number {
  const availableForCards = boardHeight - BOARD_LABEL_H - AUTO_BUTTON_H - BOARD_PAD;
  const rowHeight = Math.floor(availableForCards / 2); // 2 rows (community + player)
  return Math.min(rowHeight, rv(50)); // cap at 50pt
}

function getCardWidth(cardHeight: number): number {
  return Math.round(cardHeight / 1.4);
}
```

## STEP 4 — Test all screen sizes

```bash
# Print card dimensions for all widths:
echo "Width | Boards | CardW | CardH | AUTO visible"
for W in 320 360 375 380 390 393 402 414 428 430 440 480; do
  echo "$W | 4 | ? | ? | ?"
done
```

Add a test:
```typescript
// In responsive.test.ts:
it('AUTO button visible on all screens with 4 boards', () => {
  ALL_WIDTHS.forEach(w => {
    ALL_HEIGHTS.forEach(h => {
      const layout = getBoardLayout(4, w, h);
      const cardH = getMaxCardHeight(layout.boardHeight);
      const autoSpace = layout.boardHeight - BOARD_LABEL_H - cardH * 2 - BOARD_PAD;
      expect(autoSpace).toBeGreaterThanOrEqual(24); // AUTO button must fit
    });
  });
});
```

## STEP 5 — Also check: are logs being saved?

```bash
ANON_KEY=$(grep SUPABASE_ANON_KEY .env | cut -d= -f2)

echo "=== Bug reports today ==="
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/bug_reports?created_at=gte.2026-03-23T00:00:00Z&order=created_at.desc&limit=20" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" | python -m json.tool

echo ""
echo "=== Deploy log ==="
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/deploy_log?order=deployed_at.desc&limit=5" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" | python -m json.tool

echo ""
echo "=== Crash recordings ==="
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/storage/v1/object/list/crash-recordings" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" | python -m json.tool

echo ""
echo "=== WhatsApp sessions today ==="
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/whatsapp_sessions?created_at=gte.2026-03-23T00:00:00Z&order=created_at.desc&limit=10" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" | python -m json.tool
```

## DEPLOY

```bash
npx tsc --noEmit
npx jest --forceExit 2>&1 | tail -5
eas update --branch production --message "fix: card sizing — guarantee AUTO button visible on all devices"
git add -A && git commit -m "fix: card sizing — AUTO button always visible, cards capped by board height"
git push origin main
```

## REPORT
```
═══════════════════════════════════════
CARD SIZING FIX — REPORT
═══════════════════════════════════════
Card sizing:
  Before: cardW=[N]pt (hid AUTO on small screens)
  After: cardW=[N]pt (AUTO visible on all screens)
  Method: [subtract AUTO space first, then calculate card height]
  
  375pt + 4 boards: cardW=[N] cardH=[N] AUTO=[visible]
  393pt + 4 boards: cardW=[N] cardH=[N] AUTO=[visible]
  440pt + 4 boards: cardW=[N] cardH=[N] AUTO=[visible]

Logs check:
  Bug reports today: [N]
  Deploy log entries: [N]
  Crash recordings: [N files]
  WhatsApp sessions: [N]
  Dirty shutdown alerts sent: [N]

OTA: [ID]
Tests: [N]/[N]
═══════════════════════════════════════
```

VAMOS CAPS CARD-SIZING-FIX — END
