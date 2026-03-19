# Caps Poker — Graphics Review 2026-03-19

## Current Design

### Cards
- **Face:** White background (#FFFFFF), red (#E8192C) / black (#000000) suits
- **Layout:** Corner rank+suit (top-left), center large rank+suit — classic proportional sizing (height × 0.14/0.42)
- **Back:** Dark navy (#0f1a3e) with gold border (#c9a84c) + faint gold ♦ at 30% opacity
- **Flip animation:** 3D perspective-800 rotateY, 800ms duration
- **Highlight:** Gold glow border + spring scale-up + translateY float effect
- **Dimmed:** opacity 0.35 when not active

### Boards
- Uses `rv()` responsive helper for all sizes
- Empty slots: pulsing dashed animation when in arrangement mode
- Floating chips animation on win/lose
- Board header with pot amount + hand name overlay

### Home Screen
- 10 themes selectable: dark_gold (default), navy_silver, purple_neon, casino_red, emerald, rose_gold, ocean, sunset, arctic, matrix
- All themes: deep dark bg + single accent color (buttons, title, borders)
- Gold title "CAPS POKER" with letter-spacing
- 10 rotating taglines (fade-in cycle)
- Friends TV watermark (web-only, opacity 5-8%)

### Splash Screen
- Black background, gold suits ♠ ♥ ♦ ♣
- "CAPS POKER" title + "4 Boards. One Winner." subtitle
- Fade-in + scale animation, 3.5s total

---

## Strengths

1. **Card readability** — proportional font sizing from card height means cards look great at any size
2. **3D flip animation** — high-quality perspective flip is a premium touch
3. **Gold glow highlight** — the spring bounce + float on card selection feels tactile
4. **Theme variety** — 10 themes give personalization, all consistent in structure
5. **Dark-first** — all themes are dark, correct for a poker/gaming app
6. **Back card design** — navy + gold border + faint diamond is elegant and distinctive
7. **Responsive** — `rv()` system means cards/boards adapt to iPhone SE through iPad

---

## Weaknesses

1. **Card back too simple** — single faint diamond on flat navy. Real poker apps have rich back patterns (cross-hatch, ornamental borders, geometric)
2. **No card theme switching** — all cards are the same white/red/black. No option for "4-color suits" (blue ♣, green ♠), no dark-face cards
3. **Board felt is invisible** — board background is just `#0a0a0a` (near-black). No felt texture, no casino atmosphere
4. **Splash doesn't persist on web** — `Platform.OS === 'web'` skips splash entirely. Web users see nothing on first load
5. **home themes only affect home** — board/game screen always uses COLORS.background (#0a0a0a). Theme accent colors don't carry into the game
6. **Winner banner lacks impact** — text-only banner at 26px. Could be larger, more animated, with particle/confetti effect
7. **No player avatar/color identity** — all players look identical. No color coding (player 1 = blue, player 2 = red) on cards or chips

---

## Alternative Directions

### Option A — Luxury Dark (current direction, refined)
- Keep dark backgrounds, refine card back with ornamental border pattern
- Add felt texture to boards (subtle noise/grain via CSS/SVG)
- Increase winner celebration (confetti burst, animated banner)
- 4-color suit option in settings

### Option B — Modern Minimal
- White/light gray backgrounds
- Cards: clean Helvetica-style, no shadows, flat design
- High contrast black accents
- Risk: doesn't feel like a "casino" app — more like a scorekeeper

### Option C — Vibrant Neon (current purple_neon/matrix themes point this way)
- Very dark bg + bright neon glows on everything
- Cards get neon-colored borders based on suit
- Boards glow when a card is placed
- High engagement, more "mobile game" aesthetic

### Option D — Classic Casino
- Deep green felt (#1a4a1a) for boards
- Cream/ivory cards (#FFF8E7) with serif fonts
- Wood-grain table edges
- Most "authentic poker" look — aligns with CAPS Poker brand promise

---

## Recommendations (highest impact, lowest effort)

1. **Card back pattern** — replace flat navy with diagonal crosshatch or diamond lattice pattern. Pure CSS/SVG, no assets needed. Impact: HIGH
2. **4-color suits** — add setting: blue ♣, green ♠, red ♥, black ♦. Helps colorblind users. Impact: MEDIUM
3. **Green felt board option** — add `casino_green` to board themes (separate from home theme). `#1a4a1a` with grain texture overlay. Impact: HIGH for atmosphere
4. **Confetti on hand win** — `react-native-confetti-cannon` on winner reveal. 2-line integration. Impact: HIGH for delight
5. **Web splash** — show SplashOverlay on web too (1 second version, not 3.5s). Currently web users see blank flash. Impact: MEDIUM
6. **Theme carry-through** — use home theme accent color for board borders + active card highlight. Currently game screen is always `#0a0a0a`. Impact: MEDIUM

---

*Generated: 2026-03-19 | Build #98 | v1.9.3*
