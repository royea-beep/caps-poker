# VAMOS MEGA PROMPT — Fix X Close Button (Web)
**Version:** v1.9.4 | **Build:** b112 | **Date:** 2026-03-20 23:20 IL (UTC+2)

---

## ROLE
You are a **Senior React Native Engineer**. Quick bug fix.

## FIRST ACTIONS
```
Read C:/Users/royea/.claude/projects/C--Projects-Caps/memory/MEMORY.md
Iron Rules confirmed.
cp this file to docs/prompts/
```

---

## BUG

The X (close) button in the top-left corner of the game screen does NOT work when tapped on web. It's visible but clicking it does nothing.

## INVESTIGATION

```bash
# Find the X button in game.tsx
grep -n "backButton\|handleBack\|onPress.*Back\|router.back\|router.push\|navigation" app/game.tsx | head -20
```

Check:
1. Is `handleBack` defined and does it call `router.back()` or `router.push('/')`?
2. Is the `onPress` handler correctly wired to the Pressable?
3. Is there a `pointerEvents="none"` parent blocking the tap? (The watermark overlay might be intercepting touches)
4. Is the X button `zIndex` high enough to be above the watermark?
5. Is there an `aria-hidden` parent that's blocking interaction? (The console showed aria-hidden warnings in previous screenshots)

### Most likely cause:
The **fiveoWatermark** overlay is positioned absolutely over the entire screen with `pointerEvents="none"` — BUT it might not be working correctly on web. Or another overlay is blocking the X button.

### Fix:
- Ensure the X button (backButton) has `zIndex: 10` or higher
- Verify `pointerEvents="none"` works on the watermark for web
- Check if the header/topBar has proper zIndex above overlays
- Test that click/tap event reaches the handleBack handler

Also check ALL other buttons that might be blocked by the same issue (timer area, chips display, three-dot menu).

---

## ON COMPLETION
```bash
tsc --noEmit
npx jest --forceExit
npx expo export --platform web --clear
node scripts/fix-web-html.js
cd dist && vercel --prod --yes
git add -A && git commit -m "fix: X close button not working on web [v1.9.4-b113]" && git push
# Update MEMORY.md
```

---

*Fix autonomously. Quick fix — should be a zIndex or pointer-events issue.*
