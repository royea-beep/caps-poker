# VAMOS CAPS PRO-QUOTES
**Date:** 2026-03-21 05:35 IST

## ROLE
Creative UI developer + game designer

## FIRST ACTIONS
```
Read C:\Projects\Caps\MEMORY.md
Read C:\Projects\Caps\app\index.tsx
Read C:\Projects\Caps\app\summary.tsx
Read C:\Projects\Caps\app\game.tsx
Read C:\Projects\Caps\constants\theme.ts
ls C:\Projects\Caps\components\
```

Check if 9soccer GEMS exists:
```
ls C:\Projects\9soccer\gems\ 2>/dev/null || ls C:\Projects\9soccer\*gems* 2>/dev/null || echo "No 9soccer gems found"
```

## CONTEXT
We ran a **fictional AI digital simulation** where poker legends "playtested" CAPS.
The quotes are funny, on-brand, and we want to feature them IN the app as an entertaining Easter egg / loading content.

**CRITICAL: Every display MUST include the label:**
`"🤖 AI Digital Simulation — Not real quotes"`

This is humor, not deception. Think of it like a meme / parody feature.

## MISSION

### AGENT 1 — Quote Database
Create `constants/proQuotes.ts`:

```typescript
export interface ProQuote {
  id: string;
  player: string;
  emoji: string;
  quote: string;
  context: 'home' | 'loading' | 'complete' | 'summary' | 'waiting' | 'tutorial';
}

export const PRO_QUOTES: ProQuote[] = [
  // HOME SCREEN — rotating quote
  {
    id: 'dn1',
    player: 'Daniel Negreanu',
    emoji: '🇨🇦',
    quote: 'The most original poker mechanic since PLO',
    context: 'home',
  },
  {
    id: 'ph1',
    player: 'Phil Hellmuth',
    emoji: '👑',
    quote: 'I hate admitting it, but this is smart',
    context: 'home',
  },
  {
    id: 'pi1',
    player: 'Phil Ivey',
    emoji: '🃏',
    quote: 'Ship it.',
    context: 'home',
  },
  
  // LOADING / WAITING FOR OPPONENT
  {
    id: 'mm1',
    player: 'Michael Mizrachi',
    emoji: '💪',
    quote: 'Deal again. NOW.',
    context: 'waiting',
  },
  {
    id: 'es1',
    player: 'Erik Seidel',
    emoji: '🎩',
    quote: 'First poker game in 10 years that surprised me',
    context: 'waiting',
  },
  {
    id: 'jb1',
    player: 'Justin Bonomo',
    emoji: '🧮',
    quote: 'GTO implications are massive',
    context: 'waiting',
  },
  
  // COMPLETE BONUS — shown after sweep
  {
    id: 'ph2',
    player: 'Phil Hellmuth',
    emoji: '👑',
    quote: 'When I got COMPLETE I felt like I won a bracelet',
    context: 'complete',
  },
  {
    id: 'bk1',
    player: 'Bryn Kenney',
    emoji: '💰',
    quote: 'This is your Victory Royale moment',
    context: 'complete',
  },
  {
    id: 'ey1',
    player: 'Rampage',
    emoji: '📺',
    quote: 'COMPLETE = clips. Clips = views. Views = downloads.',
    context: 'complete',
  },
  {
    id: 'ck1',
    player: 'Chance Kornuth',
    emoji: '🎓',
    quote: 'COMPLETE mechanic = pure product genius',
    context: 'complete',
  },
  
  // SUMMARY SCREEN — after game
  {
    id: 'dn2',
    player: 'Daniel Negreanu',
    emoji: '🇨🇦',
    quote: 'I forgot I was testing. I was just playing.',
    context: 'summary',
  },
  {
    id: 'mm2',
    player: 'Michael Mizrachi',
    emoji: '💪',
    quote: 'I want to play this for money. Right now.',
    context: 'summary',
  },
  {
    id: 'ph3',
    player: 'Phil Hellmuth',
    emoji: '👑',
    quote: 'I got angry when I lost. THAT is a good sign.',
    context: 'summary',
  },
  {
    id: 'ai1',
    player: 'Ali Imsirovic',
    emoji: '🌊',
    quote: 'Played 10 hands, wanted 10 more',
    context: 'summary',
  },
  
  // GAME SCREEN — tip bar at bottom during arrangement
  {
    id: 'dn3',
    player: 'Daniel Negreanu',
    emoji: '🇨🇦',
    quote: 'Stack one board or spread evenly? THAT is the question.',
    context: 'tutorial',
  },
  {
    id: 'pi2',
    player: 'Phil Ivey',
    emoji: '🃏',
    quote: 'You can read opponents through allocation patterns',
    context: 'tutorial',
  },
  {
    id: 'jb2',
    player: 'Justin Bonomo',
    emoji: '🧮',
    quote: 'Three strategies: stack-one, spread-even, read-and-counter',
    context: 'tutorial',
  },
  {
    id: 'ck2',
    player: 'Chance Kornuth',
    emoji: '🎓',
    quote: 'Build your ENTIRE strategy around chasing COMPLETE',
    context: 'tutorial',
  },
  {
    id: 'bk2',
    player: 'Bryn Kenney',
    emoji: '💰',
    quote: '90 seconds. Perfect for quick games anywhere.',
    context: 'waiting',
  },
  {
    id: 'ey2',
    player: 'Rampage',
    emoji: '📺',
    quote: 'Chess meets Omaha meets fantasy draft',
    context: 'home',
  },
];

// Helper: get random quote for a context
export function getRandomQuote(context: ProQuote['context']): ProQuote {
  const filtered = PRO_QUOTES.filter(q => q.context === context);
  return filtered[Math.floor(Math.random() * filtered.length)];
}
```

### AGENT 2 — ProQuoteBanner Component
Create `components/ProQuoteBanner.tsx`:

A reusable component that:
- Takes `context` prop
- Shows a random quote from that context
- Displays: `emoji + "quote" — Player Name`
- Below the quote in tiny text (fontSize 8, opacity 0.4):
  `🤖 AI Digital Simulation — Not real quotes`
- Style: subtle glass background (rgba black 0.3), rounded, padding 8-12
- Text color: rgba white 0.8, italic quote, normal name
- Animates in with fadeIn (reanimated)
- Rotates to new quote every 8 seconds (if visible for long like home/waiting)
- pointerEvents: 'none' — doesn't interfere with gameplay

### AGENT 3 — Place the Banner in Screens

**A. Home Screen (`app/index.tsx`):**
- Add `<ProQuoteBanner context="home" />` above the main buttons
- Rotates every 8 seconds

**B. Game Screen — Arrangement Phase (`app/game.tsx`):**
- During ARRANGING phase ONLY — show at bottom: `<ProQuoteBanner context="tutorial" />`
- Hide during REVEAL phase
- Small, non-intrusive — acts as strategy tips

**C. Summary Screen (`app/summary.tsx`):**
- Add `<ProQuoteBanner context="summary" />` below the score table
- Static — one random quote, doesn't rotate

**D. COMPLETE Overlay (`components/CompleteOverlay.tsx`):**
- After the COMPLETE celebration animation settles
- Fade in: `<ProQuoteBanner context="complete" />`
- This is the money shot — COMPLETE + pro quote = dopamine

**E. Waiting for Opponent (multiplayer):**
- On the waiting/lobby screen: `<ProQuoteBanner context="waiting" />`
- Rotates every 6 seconds — keeps them entertained while waiting

### AGENT 4 — Settings Toggle
In Settings screen, add toggle:
- Label: `🎭 Pro Quotes (AI Simulation)`
- Description: `Show fictional poker pro reactions`
- Default: ON
- Store in AsyncStorage: `caps_show_pro_quotes`
- ProQuoteBanner checks this setting before rendering

### AGENT 5 — Tests
```
E1. Test proQuotes.ts — getRandomQuote returns correct context
E2. Test ProQuoteBanner renders quote text
E3. Test ProQuoteBanner renders disclaimer
E4. Test ProQuoteBanner returns null when setting is OFF
```

### AGENT 6 — Finish
```
F1. npx tsc --noEmit — 0 errors
F2. npx jest --forceExit — all pass
F3. npx expo export --platform web --output-dir web-dist
F4. node scripts/fix-web-html.js
F5. cd web-dist && vercel --prod --yes
F6. git add -A && git commit -m "feat: pro quotes AI simulation — fun quotes on all screens"
F7. git push origin main
F8. Update MEMORY.md
```

## SUCCESS CRITERIA
- ✅ Quotes appear on home, game (arranging), summary, COMPLETE overlay, waiting
- ✅ Every quote shows `🤖 AI Digital Simulation` disclaimer
- ✅ Toggle in settings to turn off
- ✅ Doesn't interfere with gameplay (pointerEvents none)
- ✅ Rotates smoothly with fadeIn/fadeOut
- ✅ All existing tests pass + 4 new tests
- ✅ TypeScript 0 errors

## DO NOT
- Do NOT use real photos of players
- Do NOT claim these are real quotes anywhere except the disclaimer
- Do NOT add sound files with player voices — text only
- Do NOT break any existing functionality

VAMOS CAPS PRO-QUOTES — END
