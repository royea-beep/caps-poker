# VAMOS CAPS HAND-SHARE
**Date:** 2026-03-21 12:26 IST
**Priority:** 🚀 New feature — Hand replay + share

## ROLE
5 agents: Share Card Designer, Share Engine, Web Replay, Instagram Format, QA

## FIRST ACTIONS
```
Read C:\Projects\Caps\MEMORY.md
Read C:\Projects\Caps\app\results.tsx
Read C:\Projects\Caps\utils\handEvaluator.ts
Read C:\Projects\Caps\utils\handHistory.ts
Read C:\Projects\Caps\components\Card.tsx
Read C:\Projects\Caps\store\gameStore.ts
Read C:\Projects\Caps\types\gameTypes.ts
```

Check if react-native-view-shot is installed:
```
grep "view-shot\|ViewShot" C:\Projects\Caps\package.json
```

If not:
```
npx expo install react-native-view-shot
```

Also check for share API:
```
grep "expo-sharing\|Share" C:\Projects\Caps\package.json
```
If not:
```
npx expo install expo-sharing
```

## CONTEXT
After a game, the player sees the results screen with board replay cards.
We want a "Share" button per board AND a "Share Game" button for the whole game.
Tapping Share generates a beautiful image and opens the iOS share sheet.

═══════════════════════════════════════════════════════════
AGENT 1 — SHARE CARD DESIGN
Lead: Visual Designer
═══════════════════════════════════════════════════════════

Create `components/ShareCard.tsx` — a View that renders the share image.
This is NOT shown in the UI — it's rendered offscreen by ViewShot.

### A1. Single Board Share Card (for sharing one board)

```
┌──────────────────────────────────────────────┐
│                                              │
│           ♠ CAPS POKER ♦                     │  ← gold logo
│                                              │
│  ─────────── Board 2 ───────────             │
│                                              │
│  Community                                   │
│  [3♥] [Q♠] [9♠] [7♦] [2♣]                  │  ← actual card visuals
│                                              │
│  Player                    FULL HOUSE        │  ← gold hand name
│  [A♠] [K♥] [J♦] [10♣]                      │
│                                              │
│  Opponent                  TWO PAIR          │  ← dim hand name
│  [8♣] [5♦] [3♠] [2♥]                       │
│                                              │
│  ════════════════════════════════════         │
│         ✅ YOU WIN    +150 chips              │
│  ════════════════════════════════════         │
│                                              │
│  🤖 AI Pro Quote:                            │
│  "Ship it." — Phil Ivey                      │  ← random quote
│                                              │
│         caps.ftable.co.il                    │  ← watermark
│                                              │
└──────────────────────────────────────────────┘
```

Design specs:
- Background: dark gradient `#0a0f1a` → `#12192e`
- Width: 1080px (for high-res sharing)
- Height: auto (fits content, roughly 1400px)
- Cards: use Card component at larger size (width 80, height 112)
- Gold accents for wins, dim for losses
- CAPS POKER logo at top — gold, centered
- Pro Quote at bottom — random from proQuotes.ts
- Watermark: `caps.ftable.co.il` in small text at bottom
- Rounded corners on the entire card (borderRadius 24)

### A2. Full Game Share Card (for sharing complete game)

Same style but shows ALL boards in a compact layout:

```
┌──────────────────────────────────────────────┐
│           ♠ CAPS POKER ♦                     │
│                                              │
│  B1: [cards] FULL HOUSE    ✅ +150           │
│  B2: [cards] TWO PAIR      ❌ -100           │
│  B3: [cards] FLUSH         ✅ +200           │
│  B4: [cards] HIGH CARD     ❌ -50            │
│                                              │
│  ════════════════════════════════════         │
│     NET: +200    3/4 boards won              │
│  ════════════════════════════════════         │
│                                              │
│  🏆 COMPLETE! +50% BONUS  (if applicable)    │
│                                              │
│  "The most original mechanic since PLO"      │
│        — Daniel Negreanu                     │
│                                              │
│         caps.ftable.co.il                    │
└──────────────────────────────────────────────┘
```

### A3. Instagram Story Format (1080×1920)

Same content as above but formatted for 9:16 ratio:
- More vertical space between elements
- Larger cards
- "Swipe up" or "Download CAPS" CTA at bottom
- Background fills the full 1080×1920

═══════════════════════════════════════════════════════════
AGENT 2 — SHARE ENGINE
Lead: Mobile Engineer
═══════════════════════════════════════════════════════════

Create `utils/shareHand.ts`:

### B1. Capture the share card as image

```typescript
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

interface ShareData {
  boards: BoardResult[];      // from game store
  playerName: string;
  isComplete: boolean;
  totalNet: number;
  boardsWon: number;
  totalBoards: number;
}

async function captureShareCard(viewRef: React.RefObject<View>): Promise<string> {
  const uri = await captureRef(viewRef, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
  });
  return uri;
}
```

### B2. Share via iOS Share Sheet

```typescript
async function shareHand(imageUri: string, text: string): Promise<void> {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(imageUri, {
      mimeType: 'image/png',
      dialogTitle: 'Share CAPS Hand',
      UTI: 'public.png',
    });
  }
}
```

### B3. Share flow in results.tsx

Add to each board replay card:
```
[📸 Share Board]  ← captures that one board's ShareCard
```

Add below all boards:
```
[📸 Share Game]   ← captures the full game ShareCard
```

When tapped:
1. Render ShareCard offscreen (opacity 0, position absolute, off-viewport)
2. Wait 100ms for render to settle
3. Capture with ViewShot
4. Open share sheet
5. Clean up temp file

### B4. Share button styling
- Small pill button: `rgba(255,215,0,0.15)`, gold text, gold border
- Icon: 📸 or share icon
- Press animation: scale(0.95)
- Position: right side of each board replay card header

═══════════════════════════════════════════════════════════
AGENT 3 — WEB REPLAY PAGE
Lead: Web Developer
═══════════════════════════════════════════════════════════

Create a web replay page at `caps.ftable.co.il/hand/[id]`

### C1. Save hand data for web replay

When "Share" is tapped, also generate a unique hand ID and save to Supabase:

```typescript
// In shareHand.ts
async function saveHandForWebReplay(data: ShareData): Promise<string> {
  const handId = generateShortId(); // 8 chars, alphanumeric
  
  await supabase.from('shared_hands').insert({
    id: handId,
    data: JSON.stringify(data),
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
  });
  
  return `https://caps.ftable.co.il/hand/${handId}`;
}
```

### C2. Supabase migration

```sql
CREATE TABLE IF NOT EXISTS shared_hands (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  views integer DEFAULT 0
);

ALTER TABLE shared_hands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON shared_hands FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON shared_hands FOR INSERT WITH CHECK (true);

-- Auto-delete expired hands
CREATE INDEX idx_shared_hands_expires ON shared_hands (expires_at);
```

### C3. Web replay HTML page

Create `web-replay/index.html` — a single HTML file that:
1. Reads `handId` from URL path or query param
2. Fetches hand data from Supabase
3. Renders an animated replay:
   - Shows community cards face-down
   - Flips turn card (CSS rotateY animation)
   - Flips river card
   - Shows hand names sliding in
   - Shows win/loss result
   - Shows "+chips" floating up
4. "Download CAPS Poker" CTA button at bottom
5. Dark poker theme matching the app
6. Mobile-responsive

### C4. Deploy web replay

Upload to FTP:
```
Target: /home/ftableco/public_html/caps/hand/index.html
```

URL structure: `caps.ftable.co.il/hand/?id=abc12345`
(Or configure .htaccess for clean URLs: `caps.ftable.co.il/hand/abc12345`)

═══════════════════════════════════════════════════════════
AGENT 4 — SHARE TEXT + METADATA
Lead: Growth Engineer
═══════════════════════════════════════════════════════════

### D1. Share text that accompanies the image

```typescript
function generateShareText(data: ShareData): string {
  const emoji = data.isComplete ? '🏆' : data.totalNet > 0 ? '✅' : '❌';
  const complete = data.isComplete ? '\n🏆 COMPLETE! Swept all boards!' : '';
  
  return `${emoji} CAPS Poker — ${data.boardsWon}/${data.totalBoards} boards won!${complete}
Net: ${data.totalNet > 0 ? '+' : ''}${data.totalNet} chips

Play CAPS: caps.ftable.co.il`;
}
```

### D2. Copy link button

After sharing, also offer:
```
[📋 Copy Replay Link]
```
Copies the web replay URL to clipboard with haptic feedback.

### D3. Share analytics

Track in Supabase (optional):
```sql
-- In shared_hands table, increment views:
UPDATE shared_hands SET views = views + 1 WHERE id = $1;
```

═══════════════════════════════════════════════════════════
AGENT 5 — INTEGRATION + QA + DEPLOY
Lead: QA Engineer
═══════════════════════════════════════════════════════════

### E1. Wire into Results Screen

In `app/results.tsx`:
- Import ShareCard, shareHand
- Add share buttons to each board replay card
- Add "Share Game" button below all boards, above DEAL ME IN
- The offscreen ShareCard refs need to be maintained per board

### E2. Wire into Hand History

In `app/hand-history.tsx` (if exists):
- Add share button to each past hand entry
- Same flow: generate ShareCard → capture → share

### E3. Test matrix

```
T1. Share single board → image looks correct, cards readable
T2. Share full game → all boards shown, net/stats correct
T3. Share COMPLETE game → gold border, bonus shown
T4. Share via WhatsApp → image arrives clean
T5. Share via iMessage → image arrives clean
T6. Copy replay link → opens in browser, animation plays
T7. Web replay on mobile → responsive, cards visible
T8. Web replay expired (30 days) → shows "hand expired" message
T9. Share with 2 players (4 boards) → all 4 boards fit
T10. Share with 4 players (2 boards) → layout adjusts
```

### E4. Deploy

```
F1. npx tsc --noEmit — 0 errors
F2. npx jest --forceExit — 126+ pass
F3. npx expo export --platform web --output-dir web-dist
F4. node scripts/fix-web-html.js
F5. cd web-dist && vercel --prod --yes
F6. Upload web-replay to FTP: /home/ftableco/public_html/caps/hand/
F7. npx supabase migration new shared_hands
F8. npx supabase db push
F9. git add -A && git commit -m "feat: hand replay + share — image gen, iOS share sheet, web replay, Supabase storage"
F10. git push origin main
F11. Update MEMORY.md
```

## SUCCESS CRITERIA
- ✅ "Share Board" button on each board in results
- ✅ "Share Game" button for full game summary
- ✅ Beautiful share card image (1080px wide, dark theme, gold accents)
- ✅ iOS Share Sheet opens with image + text
- ✅ Web replay page at caps.ftable.co.il/hand/[id]
- ✅ Web replay has animated card flips
- ✅ Instagram Story format (1080×1920) available
- ✅ Pro Quote included on share card
- ✅ Watermark: caps.ftable.co.il
- ✅ Supabase: shared_hands table with 30-day expiry
- ✅ Copy replay link button
- ✅ All tests pass, 0 TS errors

## DO NOT
- Do NOT change game logic
- Do NOT change existing results screen layout — ADD share buttons to it
- Do NOT share opponent's real username (show "Opponent" or "Bot")
- Do NOT break any existing features
- Do NOT remove pro quotes or voice clips

VAMOS CAPS HAND-SHARE — END
