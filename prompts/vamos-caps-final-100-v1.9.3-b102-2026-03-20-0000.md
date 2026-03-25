VAMOS CAPS FINAL-100 v1.9.3-b102 2026-03-20-0000

## Current state: v1.9.3 build #102 | commit dc20ce6
Read MEMORY.md. Iron Rules confirmed. Rule 2 UNLOCKED.
Standing Orders: Fix autonomously. Never give user commands.

## GOAL: Bring everything to 10/10. Complete ALL remaining items.

---

## TASK A — Five-O vertical card stacking in RevealSequence (agent: reveal-agent)

A1. Read components/RevealSequence.tsx in full
A2. Understand current board card layout during reveal
A3. Implement Five-O style vertical card columns:
    - Each board shows cards stacked vertically (like Five-O screenshots)
    - Community cards (5) in one column on left
    - Player cards (4) in one column on right
    - Bot cards (4) below or beside
    - Cards are taller, readable, with rank+suit clearly visible
    - WIN/LOSE banner at bottom of each board column
A4. Keep the flip animation — just change layout from horizontal to vertical
A5. npx tsc --noEmit — 0 errors

---

## TASK B — Fix spades color on 4-color suits (agent: suits-agent)

B1. Read components/Card.tsx
B2. In SUIT_COLORS_4, spades are #000000 — invisible on dark backgrounds
    Fix: change spades to #1a1a2e (very dark navy, visible on white card face)
    Or: keep black but ensure card face is always white when 4-color mode
B3. Also verify clubs green (#228B22) is visible on white card face
B4. npx tsc --noEmit — 0 errors

---

## TASK C — WhatsApp audio end-to-end verify (agent: whatsapp-agent)

C1. Check Supabase secrets:
    npx supabase secrets list --project-ref gxrpunvhjcrzqnitbqah 2>&1 | grep OPENAI

C2. Check if OPENAI_API_KEY is set — it was set earlier today
    If set: verify Edge Function v15 actually uses it (read the function)

C3. Check Twilio webhook URL status:
    curl -s -X GET "https://api.twilio.com/2010-04-01/Accounts/ACf82650af617731b2252e87eb83b31f2a/IncomingPhoneNumbers.json" \
    -u "ACf82650af617731b2252e87eb83b31f2a:$(grep TWILIO_AUTH_TOKEN /c/Projects/Caps/.env | cut -d= -f2-)" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d, indent=2))" 2>/dev/null | head -30

C4. Check if there's a sandbox webhook configured:
    The Twilio sandbox webhook URL should be:
    https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler
    
    Verify this is set. If not set via API, report the URL for manual setup.

C5. Test the bot by sending a test message programmatically:
    curl -s -X POST "https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "From=whatsapp:+972523227765&Body=test+caps+poker+bug&NumMedia=0&MessageSid=test123" 2>&1 | head -20

C6. Report: is audio working? what's the exact status?

---

## TASK D — Landscape layout polish (agent: landscape-agent)

D1. Read app/game.tsx — the landscape layout added in b101
D2. Check for issues:
    - Are all boards visible in 2x2 grid?
    - Is the hand area scrollable when many cards?
    - Is the READY button accessible?
    - Does it work on iPhone SE (375px) in landscape?
D3. Fix any layout issues found
D4. Read app/results.tsx — add landscape layout for results screen too
D5. npx tsc --noEmit — 0 errors

---

## TASK E — Final polish items from all sessions (agent: polish-agent)

E1. Web splash — currently skipped on web (Platform.OS === 'web' → splashDone=true immediately)
    Add a 1-second branded splash for web too:
    In _layout.tsx: change `useState(Platform.OS === 'web')` to `useState(false)`
    The SplashOverlay already has 3.5s timer — for web use 1s version
    
    Actually: read _layout.tsx — the SplashOverlay component has:
    `const t = setTimeout(onDone, 3500);`
    For web, use 1000ms instead of 3500ms

E2. Theme carry-through to game screen:
    Read constants/homeThemes.ts — get accent colors
    In game.tsx: use homeTheme accent for board borders + card highlight glow
    This makes the selected theme feel consistent throughout

E3. Confetti on 5-0 win (all boards won):
    Check if react-native-confetti-cannon is installed:
    grep -r "confetti" /c/Projects/Caps/package.json
    
    If not: expo install react-native-confetti-cannon
    
    In app/results.tsx: when playerWins === boardCount (all boards won):
    - Show confetti burst
    - Show special "PERFECT GAME" text instead of "YOU WIN"

E4. Check if HIGH HAND bug is actually fixed:
    Read utils/gameLogic.ts — find evaluateOmahaHand
    Run: npx jest --testPathPattern simulate --verbose 2>&1 | grep -i "hand\|pair\|flush\|straight" | head -10
    
    The bug: every hand shows as "High Card" regardless of actual hand
    Check if handName in BoardResult is being populated correctly

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors required
2. npx jest --silent — 115/115 required
3. npx expo export --platform web --clear
4. node scripts/fix-web-html.js
5. cd dist && vercel --prod --yes
6. git add -A && git commit -m "feat: Five-O vertical reveal, landscape polish, confetti, theme carry-through, final 100% [v1.9.3-b103]"
7. git push origin main
8. Update MEMORY.md with final state
9. Print updated audit table — everything should be 9-10

VAMOS CAPS FINAL-100 — END
