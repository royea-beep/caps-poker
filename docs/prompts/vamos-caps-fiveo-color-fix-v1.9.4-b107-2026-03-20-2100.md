# VAMOS MEGA PROMPT — Five-O Theme Color Fix (Round 2)
**Version:** v1.9.4 | **Build:** b107 | **Date:** 2026-03-20 21:00 IL (UTC+2)

---

## ROLE
You are a **Senior React Native UI Engineer** with expertise in color theory and casino game design.

## FIRST ACTIONS
```
Read C:/Users/royea/.claude/projects/C--Projects-Caps/memory/MEMORY.md
Iron Rules confirmed.
cp this file to docs/prompts/
```

---

## PROBLEM

The Five-O theme from b107 looks **washed out and pinkish** on screen instead of deep, dark casino red. The web screenshot shows:

1. **Background is pinkish/mauve** — #6B0F1A renders as light pinkish on screen, not the deep dark red we need. It needs to be MUCH darker — almost black with a red tint.
2. **Boards look washed out** — #9B1B30 is too bright/light for the board surface. Needs to be darker.
3. **Board borders (wood brown #8B5E3C)** — hard to tell if it works, might need to be darker too.
4. **Left panel (YOUR HAND area)** — has a dark background that doesn't match the rest. Should blend with the overall dark red theme.
5. **Overall not dark/moody enough** — the Match Five-O reference has a VERY dark atmosphere. Think of a dimly lit casino. The current colors are way too bright.

---

## THE FIX — Darker, Moodier Colors

Update `constants/visualThemes.ts` Five-O theme:

```
fiveo: {
  background: '#2D0A0E',      // VERY dark red-black — like a dimly lit casino
  surface: '#1A1A2E',         // dark navy — panels, modals (keep)
  boardBg: '#5C1018',         // dark casino red felt — darker than before
  boardBorder: '#3D2415',     // dark wood brown — subtle, not bright
  textPrimary: '#ffffff',
  textSecondary: '#FFD700',
  textMuted: '#aaaaaa',
  accent: '#FFD700',
  accentText: '#000000',
  cardFace: '#F5F5F5',
  cardBorder: 'rgba(0,0,0,0.18)',
  cardShadow: 'rgba(0,0,0,0.55)',
  primaryBtn: '#FFD700',
  primaryBtnText: '#1A1A2E',
  primaryBtnRadius: 8,
  winColor: '#28A745',
  loseColor: '#CC0000',
}
```

Key changes from b107:
| Color | b107 (too bright) | b108 (fix) | Why |
|-------|-------------------|------------|-----|
| background | #6B0F1A (pinkish) | #2D0A0E (near-black red) | Way too bright, needs to be almost black |
| boardBg | #9B1B30 (too light) | #5C1018 (dark red felt) | Should feel like a dark casino table |
| boardBorder | #8B5E3C (bright wood) | #3D2415 (dark wood) | Subtler, less distracting |

Also check:
- The **YOUR HAND** left panel — make sure it uses `theme.surface` or `theme.background` so it blends
- The **BOT** right panel — same treatment
- The **top bar** (timer, chips, X button area) — should use theme colors
- The **watermark opacity** might need to be bumped slightly (from 0.045 to 0.06) since background is darker now

---

## ALSO CHECK THESE FILES
The game.tsx styles might have hardcoded COLORS.background in places that should use theme.background:

```bash
grep -n "COLORS.background\|COLORS.surface\|COLORS.surfaceRaised" app/game.tsx | head -20
```

Every instance of `COLORS.background` in game.tsx should be evaluated — if it's visible during gameplay, it should use `theme.background` instead for the Five-O theme.

Same for Board.tsx:
```bash
grep -n "COLORS\." components/Board.tsx | head -30
```

And Card.tsx card backs — they should be dark navy (#0f1a3e) which might already be fine, but verify.

---

## SUCCESS CRITERIA
- [ ] Background is VERY dark — almost black with a subtle red warmth
- [ ] Boards are dark red, not bright/pinkish
- [ ] Overall atmosphere is dark and moody like a dimly lit casino
- [ ] Panels blend into the dark theme
- [ ] Watermark is subtle but visible
- [ ] Classic theme unchanged
- [ ] 115/115 tests pass
- [ ] TS: 0 errors
- [ ] Web deployed + git pushed

---

## ON COMPLETION
```bash
tsc --noEmit
npx jest --forceExit
npx expo export --platform web --clear
node scripts/fix-web-html.js
cd dist && vercel --prod --yes
git add -A && git commit -m "fix: Five-O theme darker — casino atmosphere [v1.9.4-b108]" && git push
# Update MEMORY.md
```

---

*Fix autonomously. The key insight: what looks like a nice red in a hex picker looks PINK on screen. Go MUCH darker than you think you need to.*
