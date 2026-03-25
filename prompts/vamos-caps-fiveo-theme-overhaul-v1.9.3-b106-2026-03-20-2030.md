# VAMOS MEGA PROMPT — Five-O Theme Visual Overhaul
**Version:** v1.9.3 | **Build:** b106 | **Date:** 2026-03-20 20:30 IL (UTC+2)

---

## ROLE
You are a **Senior React Native UI/UX Engineer** specializing in game interfaces, poker apps, and visual theming. You have an eye for premium casino-grade design.

## FIRST ACTIONS
```
Read C:/Users/royea/.claude/projects/C--Projects-Caps/memory/MEMORY.md
Iron Rules confirmed.
cp this file to docs/prompts/
```

---

## CONTEXT

Caps Poker has a theme system with two themes: **Classic** and **Five-O**. The Five-O theme currently looks WRONG — it has a generic gold/khaki background that looks nothing like the original "Match Five-O" game it's inspired by.

Roye provided 6 reference screenshots from the **real Match Five-O poker game**. Below is a DETAILED visual breakdown of every element. Your job is to make our Five-O theme match this style as closely as possible.

---

## REFERENCE: Match Five-O Visual Style (from 6 screenshots)

### 1. TABLE / GAME BACKGROUND
- **Table felt:** Deep, rich RED (#8B0000 to #B22222 range) — like a premium poker table
- **Table texture:** Subtle fabric/felt texture, not flat color
- **Watermark:** "MATCH FIVE-O" text embossed/watermarked in slightly lighter red on the table center — semi-transparent, decorative
- **Table border/rim:** Wooden frame — warm brown wood texture around the edges of the table, like a real poker table rail
- **Overall feel:** Dark, moody, casino atmosphere

### 2. CARDS
- **Face-up cards:** White/light gray background, clean professional look
- **Card size:** LARGE rank numbers, easy to read
- **Suit colors:** Standard — red for hearts/diamonds, black for spades/clubs (but clubs appear GREEN/teal in some screenshots)
- **Card style:** Slightly rounded corners, subtle shadow/depth
- **Face-down cards:** Dark navy/black back with subtle ornate pattern
- **Community cards:** Displayed prominently in the center area

### 3. UI PANELS & CONTAINERS
- **Primary UI color:** Dark navy blue (#1a1a2e to #1e2d4a range)
- **Player info panels:** Dark navy rounded rectangles with:
  - Circular avatar frame (dark navy ring with colored highlight — green for active player, red for opponent)
  - Player name in WHITE bold text
  - Chip count with red chip icon
  - Trophy/rating with gold trophy icon
  - Country flag
  - Level badge (star icon with number)
- **Score indicators:** Yellow/gold numbers in small dark boxes (showing board wins like "3" vs "2")

### 4. BUTTONS & ACCENTS
- **Primary buttons:** Golden yellow gradient (#FFD700 to #FFA500) — like "HOME", "REMATCH(3)"
- **BUY CHIPS button:** Bright green gradient, large, prominent in bottom bar
- **Bottom navigation bar:** Dark navy/black, contains: avatar, chip count, settings, gift icon, BUY CHIPS, level, stats, trophy/rating
- **AUTO button:** Not present in Five-O (different game mode)
- **Close/X button:** Gold/yellow X on dark background

### 5. WIN/LOSE INDICATORS
- **WIN badges:** Green rounded rectangle with white "WIN" text + hand description below (e.g., "TWO PAIR", "3 OF A KIND", "PAIR")
- **YOU LOSE popup:** Dark navy modal with:
  - "YOU LOSE" in bold white
  - Score "2-3" in white
  - Two golden buttons: HOME | REMATCH(3)
  - Semi-transparent dark overlay behind

### 6. LOBBY / SELECT BET SCREEN
- **Background:** Dark slate/navy (#2a2a3e) with repeating subtle spade suit pattern
- **"SELECT BET" header:** Large, bold, metallic silver/white text with 3D shadow effect
- **Bet chips:** Red/white striped poker chips for unlocked, gray/silver chips with lock icon for locked tiers
- **Bet amounts:** 10,000 / 25,000 / 100,000 / 250,000 / 500,000 / 1M
- **Game mode cards (lobby):** Colorful illustrated cards — Las Vegas neon, Mexico theme, Moscow theme, Tournament trophy — each in a rounded card with title below

### 7. TYPOGRAPHY
- **Headers:** Bold, slightly condensed, uppercase — has a metallic/embossed feel
- **"FIVE-O TOUR" title:** Metallic gold/silver gradient text with dark shadow, heavy weight
- **"MATCH FIVE-O" watermark:** Large serif/slab font, embossed into the red felt
- **Body text:** Clean white sans-serif
- **Numbers (chip counts, bets):** Bold, easy to read

### 8. COLOR PALETTE (extract from screenshots)
```
TABLE_FELT_RED:       #9B1B30 (deep casino red)
TABLE_FELT_DARK:      #6B0F1A (darker shade for depth)
WOOD_BORDER:          #8B5E3C (warm wood brown)
WOOD_BORDER_DARK:     #5C3A24 (darker wood)
NAVY_PRIMARY:         #1A1A2E (dark navy — panels, modals)
NAVY_SECONDARY:       #16213E (slightly lighter navy)
NAVY_LIGHT:           #1E2D4A (for hover/active states)
GOLD_PRIMARY:         #FFD700 (buttons, accents)
GOLD_DARK:            #CC9900 (button gradients)
GREEN_WIN:            #28A745 (win badges)
GREEN_BUY:            #34C759 (buy chips button)
WHITE:                #FFFFFF (text, card faces)
CARD_BG:              #F5F5F5 (card background)
RED_SUIT:             #CC0000 (hearts, diamonds)
BLACK_SUIT:           #1A1A1A (spades)
GREEN_SUIT:           #006644 (clubs — they use green for clubs!)
CHIP_RED:             #CC3333 (chip icon color)
TEXT_SECONDARY:       #AAAAAA (muted text)
```

---

## YOUR MISSION

### Phase 1 — Read Current Theme Implementation
```bash
# Find all theme-related files
find C:/Projects/Caps/src -name "*theme*" -o -name "*Theme*" -o -name "*color*" -o -name "*Color*" | head -20
cat C:/Projects/Caps/src/themes/  # or wherever themes live
# Understand the current theme structure before changing anything
```

### Phase 2 — Update Five-O Theme Colors & Styles
Apply the color palette above to the Five-O theme. Key changes:

| Element | Current (wrong) | Target (Match Five-O) |
|---------|----------------|----------------------|
| Game background | Gold/khaki | Deep red felt (#9B1B30) |
| Board borders | Gold | Wood brown (#8B5E3C) OR dark navy (#1A1A2E) |
| Card backs | Red/blue pattern | Dark navy with subtle pattern |
| UI panels | Gold tinted | Dark navy (#1A1A2E) |
| Buttons | Gold | Golden yellow gradient |
| Text primary | Dark | White |
| Win indicators | Unknown | Green badges |
| Overall mood | Bright/gold | Dark/moody/casino |

### Phase 3 — Apply Specific Visual Elements
1. **Table watermark:** Add "CAPS POKER" or "FIVE-O" as a subtle embossed watermark on the red felt background (low opacity, centered)
2. **Card style:** White card faces with large readable ranks. If clubs are currently black, consider making them GREEN/teal (#006644) like in the reference
3. **Board containers:** Dark navy panels instead of gold borders
4. **Player area:** Dark navy panels with avatar, name, chip count
5. **Score/result display:** Gold numbers on dark background

### Phase 4 — Web + iOS Consistency
Make sure the theme looks good on BOTH:
- Web (caps.ftable.co.il) — the screenshot Roye showed
- iOS (TestFlight) — same visual treatment

---

## IMPORTANT CONSTRAINTS
- Do NOT change the Classic theme — only modify Five-O
- Do NOT change game logic or layout — only visual styling
- Keep the existing theme switching system (theme-pick.tsx)
- The game has 4 boards in 2-player mode, 3 boards in 3-player, 2 boards in 4-player — the theme must work for all configurations
- Iron Rules 1-8 remain locked (except Rule 2 which is already unlocked)

---

## SUCCESS CRITERIA
- [ ] Five-O theme has deep red felt table background (not gold/khaki)
- [ ] UI panels are dark navy (not gold)
- [ ] Buttons are golden yellow
- [ ] Cards are clean white with large ranks
- [ ] Win/lose indicators match the green badge style
- [ ] Overall vibe is dark, moody, premium casino — NOT bright and gold
- [ ] Works on both web and iOS
- [ ] Classic theme unchanged
- [ ] All 115 tests still pass
- [ ] TypeScript: 0 errors

---

## ON COMPLETION
```bash
tsc --noEmit
npx jest --forceExit
npx expo export --platform web --clear
node scripts/fix-web-html.js
cd dist && vercel --prod --yes
git add -A && git commit -m "feat: Five-O theme visual overhaul — Match Five-O casino style [v1.9.4-b107]" && git push
# Push triggers CI → TestFlight build
# Update MEMORY.md with new theme details
```

---

## MANUAL_TASKS
(none expected — this is all code)

## CONFLICTS LIST
(add here if any visual change breaks existing components)

---

*Fix autonomously. Use 5+ parallel agents. The reference is the Match Five-O poker game — dark red table, dark navy UI, golden accents. Make it look PREMIUM.*
