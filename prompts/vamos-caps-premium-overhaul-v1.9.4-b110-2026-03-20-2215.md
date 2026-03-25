# VAMOS MEGA PROMPT — Full App Premium Visual Overhaul
**Version:** v1.9.4 | **Build:** b110 | **Date:** 2026-03-20 22:15 IL (UTC+2)

---

## ROLE
You are a **team of 7 Senior Engineers** working in parallel:
- **Agent 1:** Layout & Navigation Engineer
- **Agent 2:** Board & Card Visual Engineer
- **Agent 3:** Player Panels & Info Display Engineer
- **Agent 4:** Buttons, Badges & Interactive Elements Engineer
- **Agent 5:** Typography & Color Consistency Engineer
- **Agent 6:** Animation & Polish Engineer
- **Agent 7:** Cross-Platform QA Engineer (iOS + Web)

## FIRST ACTIONS
```
Read C:/Users/royea/.claude/projects/C--Projects-Caps/memory/MEMORY.md
Iron Rules confirmed.
cp this file to docs/prompts/

# AUDIT FIRST — read every screen file before changing anything
find C:/Projects/Caps/app -name "*.tsx" | sort
find C:/Projects/Caps/components -name "*.tsx" | sort
cat C:/Projects/Caps/constants/visualThemes.ts
cat C:/Projects/Caps/constants/gameConfig.ts | head -80
```

---

## CONTEXT

Caps Poker currently works but looks **basic and amateur**. The Five-O theme got 3 rounds of color fixes but the app still doesn't feel premium. Roye wants a **full professional overhaul** — every screen, every state, every platform. The standard is Match Five-O (a polished, published poker game).

The overhaul must work on:
- **iOS portrait** (primary mobile experience)
- **iOS landscape** (user-selected via Iron Rule 2)
- **Web desktop** (caps.ftable.co.il — wide screens)
- **Web mobile** (phone browsers)

Both themes: **Classic** AND **Five-O** — but Five-O is priority.

---

## AGENT 1 — Layout & Navigation

### 1.1 Web Layout: ALWAYS Portrait
**Problem:** Web uses landscape layout (cards on sides) when browser is wide. Looks wrong.
**Fix:** On web, ALWAYS use portrait layout regardless of screen width.
```typescript
// game.tsx — change isLandscape:
const isLandscape = storeOrientation === 'landscape' && Platform.OS !== 'web';
```

### 1.2 Portrait Layout: Cards at Bottom, Boards Above
**Problem:** In portrait, cards are in a vertical list on the left. Not intuitive.
**Fix for web:** Convert the left-side card list into a **horizontal scrollable row at the bottom** of the screen on web. On mobile portrait, the current vertical list works (small screens).
```
[  Header bar (X, timer, chips)     ]
[  Boards 2×2 grid — FULL WIDTH     ]
[  BOT status bar (compact)          ]
[  YOUR HAND — horizontal scroll     ]
```

### 1.3 Board Grid: Use Full Width
**Problem:** Boards are narrow, don't use available space on wide screens.
**Fix:** On web, let the board grid expand to use more width. Increase `WEB_MAX_WIDTH` or make boards responsive.

### 1.4 Settings Screen Theme-Aware
**Problem:** Settings screen probably uses hardcoded Classic colors.
**Fix:** Apply theme colors to settings, theme picker, and all non-game screens.

### 1.5 Home/Menu Screen Polish
**Problem:** Home screen is probably basic.
**Fix:** Apply Five-O theme to home screen — dark casino background, styled buttons, premium feel.

---

## AGENT 2 — Board & Card Visuals

### 2.1 Board Inner Depth
**Problem:** Boards are flat rectangles.
**Fix:** Add subtle inner gradient or inset shadow to give "sunken felt" effect. Already started in b110 for web — extend to iOS.

### 2.2 Board Labels (B1/B2/B3/B4)
**Problem:** Small gold text in corner, looks basic.
**Fix:** Redesign as pill-shaped badges with dark background + gold text + subtle border. Position in top-left corner.

### 2.3 Empty Card Slots
**Problem:** "+" symbols are not intuitive.
**Fix:** Replace with dashed-outline card shapes. Show a faint card outline with dashed border in theme color. No "+" text.

### 2.4 Community Cards vs Player Cards
**Problem:** No visual separation between player's placed cards and community cards.
**Fix:** Add a thin divider line or spacing gap between the 4 player slots and the community area. Community cards slightly different style (no dashed border, just the cards).

### 2.5 Card Face Polish
**Problem:** Cards are functional but not premium.
**Fix:**
- Increase border-radius to 8-10px (more rounded, modern feel)
- Add subtle gradient on card face (white top → very light gray bottom)
- Ensure suit symbols are LARGE and colorful
- Center rank should be 40-50% of card height, very bold

### 2.6 Card Back Redesign
**Problem:** Current card back is basic dark with border.
**Fix:** Navy blue (#0a1628) with subtle ornamental pattern (CSS radial-gradient circles or diamond pattern). Gold border.

### 2.7 Board Full State — Glow Enhancement
**Problem:** When board has 4 cards placed, the glow is weak.
**Fix:** Stronger green glow/pulse animation. Make it obvious the board is ready.

### 2.8 Board Winner Indication
**Problem:** After reveal, WIN/LOSE per board.
**Fix:** Ensure WIN badge shows hand name ("TWO PAIR", "FLUSH", etc.). Green for WIN, red for LOSE. Animated appearance.

---

## AGENT 3 — Player Panels & Info Display

### 3.1 YOUR HAND Panel
**Problem:** Plain text "YOUR HAND (16 REMAINING)" — boring.
**Fix:** 
- Large card count in a circle/badge: "16" in gold circle
- "cards remaining" as subtitle text
- Theme-aware background (navy for Five-O, current dark for Classic)
- Subtle border/separator from the board area

### 3.2 BOT Panel
**Problem:** "BOT" + "16 left" + "✓ READY" — very basic, no personality.
**Fix:**
- Add bot avatar (robot emoji or icon: 🤖, or a simple SVG robot face)
- Show bot "name" (e.g., "Bot" or "CPU")
- Cards remaining as a visual indicator (bar or count)
- "READY" as an animated green dot + text
- "THINKING..." with animated dots when bot is processing
- Theme-aware background matching Five-O style

### 3.3 Compact Bot Status for Portrait
**Problem:** In portrait web layout, bot info needs to fit in a compact horizontal bar.
**Fix:** Design a slim horizontal bar: [🤖 Bot | 16 cards | ✓ Ready] — all in one line.

### 3.4 Player Info Display (for multiplayer)
**Problem:** In multi-bot games, player info is minimal.
**Fix:** Each bot gets a mini-avatar + name + card count. Style like Match Five-O player cards.

---

## AGENT 4 — Buttons, Badges & Interactive Elements

### 4.1 AUTO Button
**Problem:** Basic styled button.
**Fix:** 
- Gold gradient background (Five-O) or green gradient (Classic)
- Rounded corners (12px+)
- Subtle shadow/elevation
- Icon: ⚡ or magic wand before "AUTO"
- Press animation (scale down slightly)

### 4.2 X (Close) Button
**Problem:** Plain X icon.
**Fix:** 
- Circular button with dark background + gold X (Five-O)
- Or home icon 🏠 instead of X
- Consistent size and position

### 4.3 Card Placement Interaction
**Problem:** Tap card → tap slot. The slot "+" is not clear.
**Fix:**
- When a card is selected in hand, highlight available slots with animated pulse
- Selected card gets elevated/scaled up slightly with a glow
- Placed card gets a satisfying "snap" position (could be just scale animation)

### 4.4 Timer Display
**Problem:** Simple circle with number.
**Fix:**
- Ring that depletes as time runs out
- Color transitions: green (>20s) → yellow (10-20s) → red (<10s)
- Pulse animation when under 10 seconds

### 4.5 Chips Display
**Problem:** "⊙ -1,700" — symbol + number, no styling.
**Fix:**
- Poker chip icon (🔴 or SVG red/gold chip)
- Number with proper formatting (commas)
- Green text when gaining, red when losing
- Subtle animated counter when value changes

### 4.6 "Arrange freely" / Phase Indicator
**Problem:** Small gray text, easy to miss.
**Fix:**
- Pill-shaped badge with semi-transparent background
- Larger text
- Shows current phase clearly: "ARRANGE YOUR CARDS" / "WAITING FOR BOT" / "REVEALING..."

### 4.7 Three-Dot Menu (...)
**Problem:** Random three dots.
**Fix:** Replace with gear icon ⚙️ or hamburger ☰. Consistent with casino game UIs.

### 4.8 Version Badge
**Problem:** "v1.9.4 (109)" visible in bottom right.
**Fix:** Lower opacity to 20%, smaller font. Only visible if you look for it.

---

## AGENT 5 — Typography & Color Consistency

### 5.1 Header Font
**Problem:** System font for everything.
**Fix:** Use a bold/condensed font for headers and labels. Options:
- Load a custom font via expo-font (Oswald, Bebas Neue, or Inter Bold)
- At minimum, use fontWeight: '800' or '900' for all headers
- letterSpacing: 1-2 for header text

### 5.2 Card Rank Typography
**Problem:** Ranks could be bolder.
**Fix:** fontWeight: '900', slightly condensed. Consider a poker-specific feel.

### 5.3 Color Consistency Audit
**Problem:** Some elements still use hardcoded COLORS instead of theme tokens.
**Fix:** 
```bash
grep -rn "COLORS\." app/game.tsx components/ --include="*.tsx" | grep -v "//\|import\|neonGreen\|neonRed" | wc -l
```
Every visual element should read from `theme` in components that support themes. Audit and fix all hardcoded color references.

### 5.4 Text Hierarchy
**Problem:** All text looks the same weight/size.
**Fix:** Clear hierarchy:
- H1: Board labels, WIN/LOSE, phase indicator — bold 18-24px
- H2: Panel titles, bot name — bold 14-16px
- Body: Card counts, status — regular 12-14px
- Caption: Version, muted info — 10-12px light

---

## AGENT 6 — Animation & Polish

### 6.1 Card Placement Animation
**Problem:** Card appears instantly when placed on board.
**Fix:** Animate: scale from 0.8→1.0 + slight bounce. Duration 200ms.

### 6.2 Board Complete Celebration
**Problem:** No feedback when all 4 cards are placed on a board.
**Fix:** Quick green flash/pulse on the board border. Duration 300ms.

### 6.3 Reveal Animation
**Problem:** Community cards appear all at once.
**Fix:** Stagger reveal: card 1 flips, pause 200ms, card 2 flips, etc. Builds tension.

### 6.4 WIN/LOSE Badge Animation
**Problem:** Badges appear instantly.
**Fix:** Slide up + fade in animation. Winners get a brief gold shimmer effect.

### 6.5 Score Counter Animation
**Problem:** Score changes instantly.
**Fix:** Animate chip count changes (smooth interpolation from old to new value).

### 6.6 Timer Urgency
**Problem:** Timer doesn't create urgency.
**Fix:** Under 10 seconds: timer ring pulses, color turns red, slight screen shake at 5s.

### 6.7 Page Transitions
**Problem:** Screens switch instantly.
**Fix:** Add fade transitions between home → game → results.

---

## AGENT 7 — Cross-Platform QA

After all changes, verify on ALL platforms:

### 7.1 iOS Portrait
- [ ] Boards render correctly in 2×2 grid
- [ ] Cards in vertical list scroll properly
- [ ] Timer visible and functional
- [ ] WIN/LOSE badges show correctly
- [ ] Theme switching works (Classic ↔ Five-O)

### 7.2 iOS Landscape
- [ ] Landscape layout renders correctly (cards left, boards center, bot right)
- [ ] All panels themed correctly
- [ ] No layout overflow/clipping

### 7.3 Web Desktop (1200-1920px)
- [ ] Portrait layout forced (cards bottom, boards top)
- [ ] Boards use full width
- [ ] Cards horizontal scroll at bottom
- [ ] No horizontal overflow
- [ ] Theme picker works

### 7.4 Web Mobile (375-428px)
- [ ] Same as iOS portrait
- [ ] Touch interactions work
- [ ] No layout breaks

### 7.5 Cross-Theme
- [ ] Classic theme unchanged / improved
- [ ] Five-O theme all changes applied
- [ ] Theme switch instant, no flash/glitch

### 7.6 Game States
- [ ] Arranging phase: cards selectable, slots visible
- [ ] Waiting for bot: bot status shows "thinking"
- [ ] Countdown: timer visible and animated
- [ ] Reveal: community cards flip
- [ ] Results: WIN/LOSE badges with hand names
- [ ] End game: score modal looks good

---

## BUILD NUMBER

Bump to **b111** in app.json. Keep version 1.9.4.

---

## SUCCESS CRITERIA
- [ ] Every screen looks premium (game, settings, home)
- [ ] Five-O theme feels like a real casino poker app
- [ ] Classic theme is polished and clean
- [ ] Web layout: portrait with cards at bottom
- [ ] iOS both orientations work perfectly
- [ ] All 115 tests pass | TS: 0 errors
- [ ] Web deployed + git pushed + MEMORY.md updated

---

## ON COMPLETION
```bash
tsc --noEmit
npx jest --forceExit
npx expo export --platform web --clear
node scripts/fix-web-html.js
cd dist && vercel --prod --yes
git add -A && git commit -m "feat: premium visual overhaul — all screens, all platforms [v1.9.4-b111]" && git push
# Update MEMORY.md with full changelog
```

---

## PRIORITY ORDER
If you can't do everything in one pass:
1. **MUST:** 1.1 (web portrait), 1.2 (cards bottom), 2.3 (empty slots), 3.2 (bot panel), 4.1 (AUTO btn), 4.4 (timer), 5.3 (color audit)
2. **SHOULD:** 2.5 (card face), 2.6 (card back), 3.1 (hand panel), 4.5 (chips), 4.6 (phase indicator), 6.1 (card animation)
3. **NICE:** Everything else

---

*Fix autonomously. 7 agents minimum. This is the upgrade that makes the app feel like it was built by a professional game studio. When Roye opens the app after this, the reaction should be "וואו".*
