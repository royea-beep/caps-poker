# VAMOS CAPS DUAL-FIX
**Date:** 2026-03-21 10:21 IST
**Priority:** 🔴 Two missions

## ROLE
QA auditor + backend engineer

═══════════════════════════════════════════════
MISSION 1 — AUDIT: Did both WhatsApp bug fixes actually land?
═══════════════════════════════════════════════

Two bugs were reported via WhatsApp bot today:
- **Bug A:** Card resolution low + opened in landscape
- **Bug B:** Card count wrong — "ARRANGE 16 CARDS" + "16 left" not synced when placing cards

Both got "1" (fix-only) approval. Need to verify both actually got fixed.

### Step 1 — Check git log for the fixes
```
cd C:\Projects\Caps
git log --oneline -10
git log --oneline --since="2026-03-21T07:00:00" --until="2026-03-21T11:00:00"
```

Look for commits mentioning: resolution, DPI, landscape, card count, counter, arrange, remaining.

### Step 2 — Check Bug A: Card Resolution + Landscape
```
grep -n "playsInSilentModeIOS\|portrait\|landscape\|orientation" C:\Projects\Caps\app.json
grep -n "DPI\|density\|resolution\|scale" C:\Projects\Caps\components\Card.tsx | head -20
grep -n "portrait\|landscape\|orientation" C:\Projects\Caps\app.json
```

Verify:
- Card images/SVGs support 2x/3x density? YES/NO
- Portrait-only locked in app.json? YES/NO
- Any landscape code removed/blocked? YES/NO

### Step 3 — Check Bug B: Card Count Sync
```
grep -n "remaining\|cardsRemaining\|ARRANGE\|cards.left\|getCardCount\|calculateRemaining" C:\Projects\Caps\app\game.tsx | head -20
grep -n "CARDS_PER_BOARD\|cardCount" C:\Projects\Caps\app\game.tsx | head -10
```

Verify:
- Header count ("X left") updates in real-time when card placed? YES/NO
- Header count and button count are the same variable? YES/NO
- Total = (player cards in hand) + (player cards on boards) always equals total dealt? YES/NO

### Step 4 — Report
```
═══════════════════════════════════════
BUG FIX AUDIT
═══════════════════════════════════════
Bug A (resolution + landscape):
  Commits found: [list or NONE]
  Card DPI fix: [DONE / NOT DONE]
  Portrait lock: [DONE / NOT DONE — was it already locked?]
  STATUS: [✅ FIXED / ❌ NOT FIXED / ⚠️ PARTIAL]

Bug B (card count sync):
  Commits found: [list or NONE]  
  Counter sync fix: [DONE / NOT DONE]
  Real-time update: [DONE / NOT DONE]
  STATUS: [✅ FIXED / ❌ NOT FIXED / ⚠️ PARTIAL]

WHAT'S STILL BROKEN: [list anything not fixed]
═══════════════════════════════════════
```

### Step 5 — Fix anything that's missing
If either bug was NOT actually fixed — fix it now:
- For Bug A: ensure Card.tsx uses high-DPI assets, app.json has portrait lock
- For Bug B: ensure card counter in game.tsx updates on every place/remove action

═══════════════════════════════════════════════
MISSION 2 — FIX: WhatsApp bot loses bugs on multi-input
═══════════════════════════════════════════════

**The problem:**
When user sends image + voice together, bot creates 2 separate sessions.
User replies "1" → approves the LATEST session only.
The FIRST session gets auto-cancelled (because new report cancels previous pending).
Result: one bug gets fixed, the other is lost.

### Fix approach: MERGE multi-input into ONE session

```
cat C:\Projects\Caps\supabase\functions\whatsapp-bot-handler\index.ts
```

**Changes needed:**

**A. Add a short buffer window (10 seconds):**

When a message arrives:
1. Check if there's a pending message from the same sender within the last 10 seconds
2. If YES → MERGE: append the new content to the existing pending message
   - image + voice = combine both descriptions into one plan
   - image + text = use text as description, image as context
3. If NO → create new session as normal

```typescript
// Pseudo-code for merge logic:
const MERGE_WINDOW_MS = 10_000; // 10 seconds

async function checkForRecentMessage(sender: string): Promise<PendingMessage | null> {
  const { data } = await supabase
    .from('whatsapp_sessions')
    .select('*')
    .eq('sender', sender)
    .eq('status', 'pending_merge')  // new status
    .gte('created_at', new Date(Date.now() - MERGE_WINDOW_MS).toISOString())
    .order('created_at', { ascending: false })
    .limit(1);
  return data?.[0] || null;
}
```

**B. New flow:**

```
Message 1 arrives (image) at T=0:
  → Process image (Claude Vision → description)
  → Store as status: 'pending_merge' (not 'pending_approval' yet)
  → Set timeout: 10 seconds
  → Reply: "📸 קיבלתי תמונה. שולח עוד מידע? (יש 10 שניות לצרף טקסט או הודעה קולית)"

Message 2 arrives (voice) at T=3:
  → Process voice (Whisper → text)
  → Find pending_merge from same sender within 10s window
  → MERGE: combine image description + voice text
  → Update session: status → 'pending_approval'
  → Generate ONE combined plan
  → Reply with combined analysis + 1/2/3 options

If no Message 2 within 10 seconds:
  → Auto-promote: status → 'pending_approval'
  → Generate plan from image alone
  → Reply with analysis + 1/2/3 options
```

**C. Handle "List both fixes please" response:**

The user sent "List both fixes please" — the bot should handle free-text responses about pending sessions:
- If there's a pending session and user sends text that's NOT 1/2/3:
  - Treat as additional context → append to session
  - Regenerate plan with combined context
  
**D. Don't auto-cancel previous session when media arrives:**

Current code: new report auto-cancels previous pending session.
Fix: only auto-cancel if previous session is older than 5 minutes.
Within 5 minutes → try to merge instead.

### Deploy
```
cd C:\Projects\Caps
npx supabase functions deploy whatsapp-bot-handler --no-verify-jwt
```

Verify:
```
curl -s -o /dev/null -w "%{http_code}" https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler
```

═══════════════════════════════════════════════
FINISH
═══════════════════════════════════════════════

```
F1. npx tsc --noEmit — 0 errors
F2. npx jest --forceExit — 126+ pass  
F3. git add -A && git commit -m "fix: audit WA bug fixes + bot multi-input merge (10s window)"
F4. git push origin main
F5. Update MEMORY.md
```

## SUCCESS CRITERIA
- ✅ Both bugs (resolution + card count) confirmed fixed or fixed now
- ✅ WhatsApp bot merges image+voice within 10s into ONE session
- ✅ "Receiving more info..." reply on first media
- ✅ Combined plan after merge window closes
- ✅ No more lost bugs on multi-input
- ✅ Edge Function deployed, alive

## DO NOT
- Do NOT change game UI (already handled in Mission 1 if needed)
- Do NOT break existing 1/2/3 approval flow
- Do NOT change sound/voice features

VAMOS CAPS DUAL-FIX — END
