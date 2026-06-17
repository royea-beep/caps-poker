# VAMOS CAPS CAPS-FINAL-LAUNCH-PREP
**Date:** 2026-04-23 IST

---

## FOUR TASKS — Card Bible + Apple Blockers finish + CLAUDE.md + Deploy

### GAME RULES:
- 2P=4 boards, 3P=3 boards, 4P=2 boards. 4 cards PER BOARD. 52-card deck.

### CARD.TSX IS NOW UNLOCKED — CARD BIBLE ACTIVE.

---

## TASK 1 — CARD BIBLE: Fix card readability (#1 tester complaint)

### Problem (from card_readability_brief):
"Cards hard to read, text too small or low contrast" — top tester complaint on iPhone 17 Pro Max.

### Current state:
- Cards: warm white #FFFEF8 background, red/black suits, corner pips
- Board: maroon felt #5C1818
- Config: `min_font_size_px: 14`, `main_rank_size_ratio: 0.35`, `main_suit_size_ratio: 0.25`

### What to fix in Card.tsx:

**A. Increase rank/suit font size (15-20% bigger):**
```typescript
// Find rank text size — increase by 20%
// Current: something like fontSize: cardHeight * 0.35
// New: fontSize: cardHeight * 0.42

// Find suit symbol size — increase by 20%
// Current: something like fontSize: cardHeight * 0.25
// New: fontSize: cardHeight * 0.30
```

**B. Increase contrast:**
```typescript
// Suit colors — make bolder/darker for readability on white cards:
// Hearts/Diamonds: '#CC0000' (was likely lighter red)
// Spades/Clubs: '#111111' (was likely lighter black/gray)
```

**C. Make rank text bolder:**
```typescript
// Rank text: fontWeight '800' or '900' (was likely '700' or '600')
// This makes the biggest single improvement for readability
```

**D. Corner pip size increase:**
```typescript
// Corner rank + suit — increase by 25%
// These are the most-read elements on a card in a multi-board layout
// Current corner font: probably 10-12px
// New: at least 14px minimum (matches min_font_size_px config)
```

**E. Update card_display config in Supabase for the new ratios:**
```bash
# After making changes, read the actual new values from Card.tsx and update:
# supabase.from('app_config').update({ value: { ...currentConfig, main_rank_size_ratio: 0.42, main_suit_size_ratio: 0.30, min_font_size_px: 16 } }).eq('key', 'card_display')
```

### IMPORTANT — what NOT to change:
- Card background color (#FFFEF8 warm white) — keep
- Red/black suit color scheme (not 4-color) — keep  
- Card shape/border-radius — keep
- Gold borders on face cards — keep
- 3D flip animation — keep
- Overall card dimensions — keep (responsive via rv())

### How to verify:
1. Open the game on iPhone 17 Pro Max
2. Play a 2-player game (4 boards — tightest layout)
3. Can you read EVERY rank and suit clearly without squinting?
4. Compare Board.tsx community cards AND PlayerHand cards — both readable?

---

## TASK 2 — Home footer disclaimer (remaining from APPLE-BLOCKERS)

In `app/index.tsx` (or `app/(tabs)/index.tsx` — whichever is the active home screen), add at the VERY BOTTOM, after all other content:

```typescript
<Text style={{
  color: '#444',
  fontSize: 10,
  textAlign: 'center',
  marginTop: 24,
  marginBottom: 8,
}}>
  {'משחק חינמי | צ\u0027יפים וירטואליים בלבד | גילאי 12+'}
</Text>
```

Check BOTH files if they exist:
```bash
ls app/index.tsx app/\(tabs\)/index.tsx 2>/dev/null
```
Apply to whichever is actively used (or both if both render).

---

## TASK 3 — CLAUDE.md in project root

Create `CLAUDE.md` in the project root (`C:\Projects\POKER\Caps\CLAUDE.md`):

```markdown
# CAPS Poker — Claude Code Brain

## Quick start
1. Run on Empire HQ (vjxqlqtlywovnbidovit):
   SELECT bot_landing_brief('caps-poker');
2. Read the response — it has EVERYTHING: state, blockers, rules, risks
3. Register your session:
   SELECT bot_register_session('caps-poker', 'cc-caps-main', 'claude_code', 'task description');
4. Heartbeat every 10-15 min:
   SELECT bot_heartbeat('SESSION_ID', 'current task');
5. End session:
   SELECT bot_end_session('SESSION_ID', 'handoff notes');

## Project IDs
- Supabase (CAPS): gxrpunvhjcrzqnitbqah
- Empire HQ: vjxqlqtlywovnbidovit
- GitHub: royea-beep/caps-poker
- Web: caps.ftable.co.il (Vercel)
- Local: C:\Projects\POKER\Caps

## Game rules (CRITICAL — memorize)
- Board count DYNAMIC: 2P=4, 3P=3, 4P=2
- Each player: 4 cards PER BOARD (not 4 total)
- Each board: 5 community cards
- Single 52-card deck, max 4 players
- Code: getBoardCount() + getCardsPerPlayer() in constants/gameConfig.ts
- NEVER hardcode board counts

## Current state (Apr 2026)
- Version: 2.7.0 | Build: B458 (building)
- Tests: 2,474/2,474
- 56 tables, 127 RPCs, 16 Edge Functions
- Visual: maroon felt #5C1818, warm cards #FFFEF8, red/black suits
- 5 tabs: בית/שחק/חברים/כוסות/פרופיל
- 100% Hebrew UI
- Auth: Anonymous + Google login prompt after game 3-5

## Key RPCs
- health_check() — run first every session
- get_current_build() — what build is live
- delete_user_account(device_id, user_id) — account deletion (22 tables)
- merge_guest_to_user(device_id, user_id) — guest to Google merge
- track_event(event, device_id, properties, screen) — analytics
- get_home_screen_v3(device_id or user_id) — home data

## Key files
- app/(tabs)/index.tsx — Home (2475 lines)
- app/game.tsx — Game (~1486 lines)
- app/results.tsx — Results (~1099 lines)
- app/settings.tsx — Settings + account deletion
- components/Card.tsx — Card rendering (CARD BIBLE)
- components/Board.tsx — Board display
- utils/auth.ts — Anonymous + Google auth
- utils/analytics.ts — Supabase track_event
- utils/supabase.ts — Client with AsyncStorage persistence
- constants/gameConfig.ts — getBoardCount(), game constants

## Hard rules
- DO NOT hardcode board counts — use getBoardCount()
- Colors look PINK on screen — go 2-3x darker than hex picker
- Alert.alert fails on web — skip on web, navigate directly
- expo-file-system legacy functions BROKEN in SDK 55
- All analytics via Supabase track_event RPC (NOT PostHog)
- Never suggest App Store submission unless Roye says so
- GitHub Actions builds (not EAS)
- VAMOS = always .md file, never chat-only instructions

## Before ANY release
1. Full test suite green
2. Visual check every screen on device
3. Progressive disclosure: screens not overloaded for new players
4. No half-done features visible
5. No encoding bugs (check for broken emoji/unicode)
```

---

## TASK 4 — Deploy everything

```bash
# TypeScript check
npx tsc --noEmit 2>&1 | tail -5

# Tests
npx jest --forceExit 2>&1 | tail -5

# OTA deploy (app changes: Card readability + home footer)
npm run ota -- --message "feat: Card readability improvements + home disclaimer footer"

# Web deploy (privacy + terms pages)
npx expo export --platform web --clear
node scripts/fix-web-html.js
cd dist && vercel --prod --yes && cd ..

# Git
git add -A && git commit -m "feat: Card Bible readability fix + home footer + CLAUDE.md"
git push origin main
```

After web deploy, verify:
```bash
curl -s -o /dev/null -w "%{http_code}" https://caps.ftable.co.il/privacy.html
curl -s -o /dev/null -w "%{http_code}" https://caps.ftable.co.il/terms.html
# Both should return 200
```

---

## AFTER AUDIT
```
CARD BIBLE:
  Rank font size increased ~20%:             YES/NO
  Suit symbol size increased ~20%:           YES/NO
  Rank fontWeight 800+:                      YES/NO
  Corner pip font >= 14px:                   YES/NO
  Heart/Diamond color: deep red:             YES/NO
  Spade/Club color: near-black:              YES/NO
  Card background unchanged (#FFFEF8):       YES/NO
  Readable on 4-board layout (2P)?           YES/NO (visual check needed)

APPLE BLOCKERS:
  Home footer disclaimer visible:            YES/NO
  privacy.html accessible at URL:            YES/NO
  terms.html accessible at URL:              YES/NO

CLAUDE.md:
  CLAUDE.md exists at project root:          YES/NO
  Contains Empire HQ quick start:            YES/NO
  Contains game rules:                       YES/NO
  Contains key files list:                   YES/NO
  Contains hard rules:                       YES/NO

DEPLOY:
  Tests passing:                             [N]/[N]
  OTA deployed:                              [hash]
  Web deployed (Vercel):                     YES/NO
  Git pushed:                                [commit]
```

Yes, allow all edits.
VAMOS CAPS CAPS-FINAL-LAUNCH-PREP — END
