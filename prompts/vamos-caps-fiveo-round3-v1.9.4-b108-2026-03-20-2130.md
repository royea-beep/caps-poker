# VAMOS MEGA PROMPT — Five-O Theme Polish + CORS Fix (Round 3)
**Version:** v1.9.4 | **Build:** b108 | **Date:** 2026-03-20 21:30 IL (UTC+2)

---

## ROLE
You are a **Senior React Native UI Engineer + DevOps**. Two tasks: visual polish and a CORS bug.

## FIRST ACTIONS
```
Read C:/Users/royea/.claude/projects/C--Projects-Caps/memory/MEMORY.md
Iron Rules confirmed.
cp this file to docs/prompts/
```

---

## TASK 1 — Five-O Theme Polish (PRIORITY)

### Current problems (from screenshot):

1. **Background (#2D0A0E) looks brownish/purple** — not reading as "red casino" on screen. It's dark enough now, but the HUE is wrong. Needs to shift more toward pure dark red, less brown.

2. **Boards don't stand out from background** — the board surfaces (#5C1018) and background (#2D0A0E) are too similar in darkness. Need MORE CONTRAST between them. The boards should "pop" — they're the main play area. In the Match Five-O reference, the boards (red felt) are clearly brighter than the surrounding area.

3. **Board borders barely visible** — #3D2415 is too dark/subtle. In the reference, the table has a clear wooden rail or golden/warm border that separates the boards from the background. Make the border more visible — either brighter wood brown or a gold accent line.

4. **Left panel (YOUR HAND) is too dark/black** — it looks disconnected from the rest. Should have a dark red or dark navy tint that connects visually with the theme.

5. **Cards on dark boards** — the cards are readable but the small rank/suit indicators in the corners could use better contrast. Consider making card shadows slightly stronger or card borders more visible against the dark board.

6. **AUTO button** — currently gold on dark board, check it's clearly visible and looks good.

7. **BOT panel on right** — same issue as left panel, too disconnected.

### The Fix — Better Contrast & Cohesion

Update `constants/visualThemes.ts`:
```
fiveo: {
  background: '#1C0508',      // very dark red-black (pure red hue, not brown)
  surface: '#1A1A2E',         // dark navy for panels
  boardBg: '#6B1520',         // BRIGHTER than background — boards need to POP
  boardBorder: '#8B6914',     // warm golden-brown — visible table rail
  textPrimary: '#ffffff',
  textSecondary: '#FFD700',
  textMuted: '#bbbbbb',       // slightly brighter for readability
  accent: '#FFD700',
  accentText: '#000000',
  cardFace: '#FAFAFA',        // pure white cards
  cardBorder: 'rgba(0,0,0,0.25)',   // slightly stronger border
  cardShadow: 'rgba(0,0,0,0.6)',    // deeper shadow for depth
  primaryBtn: '#FFD700',
  primaryBtnText: '#1A1A2E',
  primaryBtnRadius: 8,
  winColor: '#28A745',
  loseColor: '#CC0000',
}
```

Key principle: **Background = very dark, Boards = noticeably brighter dark red, Border = visible warm accent.** The boards should be the brightest red element — they're the poker table surface.

### Also fix in game.tsx / Board.tsx:

**Left panel (YOUR HAND area) and right panel (BOT area):**
- Find where their background is set
- In Five-O theme, use `theme.surface` (#1A1A2E dark navy) or a semi-transparent dark overlay
- They should feel like the "rail" or side area of a poker table

**Board component styling:**
- Make sure `boardBg` and `boardBorder` from the theme are actually being applied
- Check if Board.tsx uses hardcoded `COLORS.boardBg` — if so, it needs to read from theme
- The board border should have enough width to be visible (at least 2px)

```bash
# Check if Board.tsx reads theme colors or hardcoded COLORS
grep -n "COLORS.boardBg\|COLORS.boardBorder\|theme\.\|getTheme\|visualTheme" components/Board.tsx
```

**If Board.tsx uses hardcoded COLORS.boardBg instead of theme colors, THAT'S THE MAIN BUG.** The visualThemes.ts colors only work if components actually read them. Fix Board.tsx to use theme-aware colors.

Same check for Card.tsx:
```bash
grep -n "COLORS\.\|theme\.\|getTheme\|visualTheme" components/Card.tsx | head -20
```

### Additional visual touches:
- Board border: try `borderWidth: 2` if currently 1
- Board container: add subtle inner shadow or gradient overlay to simulate felt texture
- Consider adding a subtle radial gradient on the board (darker at edges, slightly lighter at center) — but only if easy to implement

---

## TASK 2 — CORS Error Fix

Console shows:
```
Access to fetch at 'https://gxrpunvhjcrzqnitbqah.supabase.co/...' from origin 'https://caps.ftable.co.il' has been blocked by CORS policy
```

The failing request looks like `ync-bugs-to-drive` (sync-bugs-to-drive function?).

**Investigation:**
```bash
# Find all Supabase function calls in the codebase
grep -rn "supabase.co/functions\|supabase.*invoke\|sync.*bug\|ync-bugs" /c/Projects/Caps/src/ /c/Projects/Caps/app/ /c/Projects/Caps/utils/ /c/Projects/Caps/store/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -20
```

**Fix options:**
1. If it's an Edge Function — add CORS headers to the function response
2. If it's a non-essential call (like analytics/bug sync) — wrap in try/catch so it doesn't spam console
3. If the function doesn't exist yet — create it or disable the call

---

## SUCCESS CRITERIA
- [ ] Boards clearly stand out from background (visible contrast)
- [ ] Board borders clearly visible (warm gold/wood accent)
- [ ] Left/right panels blend with theme (not disconnected black)
- [ ] Cards are crisp and readable on dark boards
- [ ] CORS error fixed or suppressed
- [ ] Classic theme unchanged
- [ ] 115/115 tests pass | TS: 0 errors
- [ ] Web deployed + git pushed

---

## ON COMPLETION
```bash
tsc --noEmit
npx jest --forceExit
npx expo export --platform web --clear
node scripts/fix-web-html.js
cd dist && vercel --prod --yes
git add -A && git commit -m "fix: Five-O theme round 3 — contrast + CORS [v1.9.4-b109]" && git push
# Update MEMORY.md with b109
```

---

*Fix autonomously. THE KEY: boards must POP against the dark background. If Board.tsx uses hardcoded COLORS instead of theme colors, fix that first — everything else is cosmetic tweaks on top.*
