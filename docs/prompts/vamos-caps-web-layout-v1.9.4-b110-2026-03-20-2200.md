# VAMOS MEGA PROMPT — Web Layout Fix: Cards Bottom, Boards Top
**Version:** v1.9.4 | **Build:** b110 | **Date:** 2026-03-20 22:00 IL (UTC+2)

---

## ROLE
You are a **Senior React Native UI/Layout Engineer**. You fix layouts fast and correctly.

## FIRST ACTIONS
```
Read C:/Users/royea/.claude/projects/C--Projects-Caps/memory/MEMORY.md
Iron Rules confirmed.
cp this file to docs/prompts/
```

---

## PROBLEM

On web (desktop browser), the game uses the **landscape layout** because the screen is wide. This puts:
- YOUR HAND cards on the **LEFT** side
- Boards in the **CENTER**
- BOT info on the **RIGHT**

This is WRONG for web. It should use the **portrait layout** regardless of screen width:
- **Boards on TOP** — 2×2 grid spreading across the full width
- **Cards on BOTTOM** — horizontal scrollable hand at the bottom
- This is how Match Five-O works and it's much more intuitive

---

## THE FIX

The issue is in `app/game.tsx`. The `isLandscape` variable determines which layout to use:

```typescript
const isLandscape = storeOrientation === 'landscape' || (Platform.OS === 'web' && screenW > SCREEN_H);
```

The condition `Platform.OS === 'web' && screenW > SCREEN_H` forces web to landscape when the browser window is wider than tall (which is always on desktop).

### Option A — Simple fix (recommended):
**On web, ALWAYS use portrait layout.** Change the isLandscape condition:

```typescript
const isLandscape = storeOrientation === 'landscape' && Platform.OS !== 'web';
```

This means:
- **iOS portrait:** portrait layout ✅
- **iOS landscape:** landscape layout (user chose it) ✅
- **Web (any size):** portrait layout always ✅

### Option B — If Roye wants landscape option on web later:
Add a web-specific override that defaults to portrait but allows toggle. But for now, Option A is the move.

---

## ALSO CHECK

After forcing portrait on web, verify:
1. The portrait layout renders correctly at typical desktop widths (1200-1920px)
2. Cards at the bottom are horizontally scrollable and visible
3. Boards grid uses available width well (not too narrow, not too wide)
4. The `WEB_MAX_WIDTH` constraint still applies correctly
5. Header bar (X, timer, chips) renders correctly
6. BOT info is visible somewhere (in portrait it's usually above the boards or in a compact bar)

### Additional layout improvements for web portrait:
- Board grid: use more of the available width on wide screens
- Cards in hand: show them larger since there's more horizontal space
- Consider reducing the vertical card list to a horizontal row at the bottom for web

---

## SUCCESS CRITERIA
- [ ] Web shows portrait layout: boards on top, cards on bottom
- [ ] Boards use full available width in 2×2 grid
- [ ] Cards are visible and accessible at the bottom
- [ ] iOS landscape still works (for users who chose landscape)
- [ ] iOS portrait still works
- [ ] 115/115 tests | TS: 0 errors
- [ ] Web deployed + git pushed

---

## ON COMPLETION
```bash
tsc --noEmit
npx jest --forceExit
npx expo export --platform web --clear
node scripts/fix-web-html.js
cd dist && vercel --prod --yes
git add -A && git commit -m "fix: web always portrait — cards bottom, boards top [v1.9.4-b111]" && git push
# Update MEMORY.md
```

---

*Fix autonomously. The fix is one line change to isLandscape. Then verify the portrait layout looks good on wide screens.*
