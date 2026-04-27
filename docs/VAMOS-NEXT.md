# VAMOS CAPS — UX TOP 5
**Date:** 2026-04-27 | **Source:** ux-audit-2026-04-27.md

These 5 tasks are ordered by behavioral impact. Each is self-contained.

---

# VAMOS CAPS BOARD-EXPLAIN
**Date:** 2026-04-27 | **Priority:** high

## TASK 1 — Surface the 2-of-4 best-combo cards on results screen

### Find the code
```bash
grep -n "playerHandName\|bestRank\|bestName\|HAND_ORDER" app/results.tsx | head -20
grep -n "winner\|playerHandName\|botHandName" components/BoardResultCard.tsx | head -20
grep -n "selectedCards\|bestCards\|bestTwo\|bestCombo\|bestHoleCards" utils/gameLogic.ts | head -20
```

### Fix to apply
In `results.tsx`, inside the board loop (around line 720 where `boards.forEach` is used for bestRank), add a per-board display of which two player cards were selected by the evaluator.

In `components/BoardResultCard.tsx`, add a prop `selectedCards?: Card[]` and render it below the hand name as a small horizontal card strip.

Pass the selected cards from `calculateHandResultsMulti` return value through `revealData.boards` — check if `RevealBoardData` in `types/gameTypes.ts` already carries `selectedPlayerCards`; if not, add the field.

### BEFORE
```
Board 3: Two Pair — BOT WINS
```

### AFTER
```
Board 3: Two Pair  (K♥ + 9♦ used)
Bot: Flush — BOT WINS
```

---

# VAMOS CAPS LOGIN-TIMING
**Date:** 2026-04-27 | **Priority:** high

## TASK 2 — Delay LoginPromptModal until after win overlay clears

### Find the code
```bash
grep -n "shouldPromptLogin\|setShowLoginPrompt\|showLoginPrompt" app/results.tsx
grep -n "showWinOverlay\|winOverlayOpacity\|WIN_OVERLAY" app/results.tsx
grep -n "shouldPromptLogin\|count >= 3" utils/auth.ts
```

### Fix to apply
In `results.tsx`, change the login prompt trigger from an immediate call (line ~346) to a deferred call that waits for one of two events:

- **Win path**: trigger after `showWinOverlay` becomes false (the 3-second overlay completes)
- **Loss path**: trigger after a 2.5-second delay (player has had time to process the score)

Remove the login check from the fire-and-forget `void (async () => {...})()` block and move it into a `useEffect` that depends on `showWinOverlay`.

### BEFORE
```typescript
// results.tsx ~line 342
void (async () => {
  try {
    const prev = parseInt((await AsyncStorage.getItem('caps_total_games')) ?? '0', 10);
    await AsyncStorage.setItem('caps_total_games', String(prev + 1));
    if (await shouldPromptLogin()) setShowLoginPrompt(true);  // fires immediately
  } catch {}
})();
```

### AFTER
```typescript
// Increment game counter immediately (keep this part)
void (async () => {
  try {
    const prev = parseInt((await AsyncStorage.getItem('caps_total_games')) ?? '0', 10);
    await AsyncStorage.setItem('caps_total_games', String(prev + 1));
    setShouldCheckLogin(true); // flag, don't show yet
  } catch {}
})();

// Separate effect — show login prompt only after win overlay is gone
useEffect(() => {
  if (!shouldCheckLogin) return;
  if (showWinOverlay) return; // wait for celebration to finish
  const t = setTimeout(async () => {
    if (await shouldPromptLogin()) setShowLoginPrompt(true);
  }, revealData?.netChips > 0 ? 0 : 2500); // win: right after overlay; loss: 2.5s delay
  return () => clearTimeout(t);
}, [shouldCheckLogin, showWinOverlay]);
```

---

# VAMOS CAPS FRIENDS-EMPTY
**Date:** 2026-04-27 | **Priority:** medium

## TASK 3 — Add empty-state CTA to Friends tab for new users

### Find the code
```bash
cat app/\(tabs\)/friends.tsx
grep -n "referral\|invite\|GAMES_PLAYED_KEY" app/\(tabs\)/friends.tsx
grep -n "gamesPlayed\|multiplayer_games\|social" app/\(tabs\)/friends.tsx
```

### Fix to apply
In `app/(tabs)/friends.tsx`, read `caps_games_played` from AsyncStorage on mount. If `gamesPlayed < 3`, render an empty-state hero above the navigation cards. The empty state should have:
- Headline: "CAPS עם חברים" (Hebrew-first)
- Subtext: "הזמן חבר — שניכם תקבלו 100 ג'טונים"
- Primary CTA button that calls `router.push('/referral')` with the same gold style as other CTAs

The four navigation cards remain — they just sit below the empty state for new users and become the full screen once the user is past game 3.

### BEFORE
```
[FRIENDS header]
[Invite friends card]
[Leaderboard card]
[Host Online Game card]
[Join Game card]
```

### AFTER (for gamesPlayed < 3)
```
[FRIENDS header]
[--- empty state hero ---]
  CAPS עם חברים
  הזמן חבר — שניכם תקבלו 100 ג'טונים
  [🎁 שתף קישור] ← gold CTA
[--- then the 4 nav cards ---]
```

---

# VAMOS CAPS HINT-PLACEMENT
**Date:** 2026-04-27 | **Priority:** medium

## TASK 4 — Move efficiency hint above the fold on results screen

### Find the code
```bash
grep -n "efficiencyHint\|EfficiencyCard\|getEfficiencyHint" app/results.tsx
grep -n "ScrollView\|scrollContent\|titleSection\|scoreDisplay" app/results.tsx | head -20
grep -n "efficiencyHint\|hint" components/EfficiencyCard.tsx | head -10
```

### Fix to apply
In `results.tsx`, find where `EfficiencyCard` is rendered in the ScrollView content. Move the `EfficiencyCard` block to appear immediately after the score/title section (`styles.titleSection`), before the per-board result cards.

Additionally, add a 2-second delayed toast that fires `efficiencyHint` as a temporary overlay (similar to the `earnToast` pattern already in the file at line ~793) so players who auto-continue in the 7-second window still see the hint.

### BEFORE
```
[Title: YOU WIN / YOU LOSE]
[Score: 3 — 1]
[Board 1 result]
[Board 2 result]
[Board 3 result]
[Board 4 result]
[XP bar]
[EfficiencyCard ← buried here]
[Share section]
```

### AFTER
```
[Title: YOU WIN / YOU LOSE]
[Score: 3 — 1]
[EfficiencyCard ← promoted here, immediately below score]
[Board 1 result]
[Board 2 result]
...
```

---

# VAMOS CAPS STREAK-SHIELD
**Date:** 2026-04-27 | **Priority:** medium

## TASK 5 — Add streak grace-period shield for 7+ day streaks

### Find the code
```bash
grep -n "claim_daily_streak\|dailyRewardStreak\|getNextStreak" app/\(tabs\)/index.tsx | head -20
grep -n "streakBadge\|streak_popup\|streakData" app/\(tabs\)/index.tsx | head -20
grep -n "getNextStreak\|canClaimDailyReward" utils/economy.ts | head -10
grep -rn "claim_daily_streak" supabase/ | head -10
```

### Fix to apply
**Client side** (`utils/economy.ts` or wherever `getNextStreak` lives): add a `hasStreakShield(streak: number): boolean` helper that returns `true` when `streak >= 7`.

**Client UI** (`app/(tabs)/index.tsx`, streak badge around line 1353): when `hasStreakShield` is true, render a small shield icon (🛡) next to the streak count and add a tooltip or subtitle: "אחד חסרה ✓" (one miss forgiven).

**Daily reward modal** (`DailyRewardModal` component or inline in index.tsx): when the shield is active, show "הגנת רצף פעילה" (streak shield active) below the streak count.

**Supabase RPC** (`supabase/functions` or migrations): update `claim_daily_streak` to allow a 48-hour window instead of 24-hour when the current streak is >= 7 and no shield has been used in the last 30 days. Add a `streak_shield_used_at` column to `daily_streaks` table (or equivalent).

### BEFORE
```
🔥 14-day streak
[miss a day → streak resets to 0, no warning, no mercy]
```

### AFTER
```
🔥 14 🛡  ← shield icon when streak >= 7
[miss one day → shield activates, streak continues]
[miss two days → streak resets, shield consumed]
[UI shows: "הגנת רצף פעילה — יום אחד מוגן"]
```
