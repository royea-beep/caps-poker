---
name: caps-build-checklist
description: Use whenever a new CAPS Poker build (b<N>) lands on TestFlight and the user wants verification, or whenever Claude is about to mark a build status=live in build_history. Activates on phrases like "b372 הגיע", "b373 לבדיקה", "build is live", "אישרת את ה-build". Provides the full QA checklist that should run on every build before it's considered stable.
---

# CAPS Poker — Per-Build QA Checklist

## Purpose

Every build needs the same baseline checks. Without a fixed list, regressions slip through. This skill is the canonical checklist. Run it (or guide Roye through it) before flipping any build to status=live.

## When to invoke this skill

- Roye says "b<N> הגיע" or "b<N> לבדיקה" or sends new screenshots
- Claude is about to UPDATE `build_history SET status='live'`
- After major architectural changes (layout pivot, settings reorg)

## Pre-check: which screens did Roye actually capture?

Common gap: Roye sends 3 screenshots of the placement phase only. The build then "looks fine" but home/menu/settings/reveal are unverified. Before approving, identify what's covered and what's not:

| Screen | Confirmed by |
|---|---|
| Home | Title visible + PLAY button visible + counter selector visible |
| Side menu | Avatar tapped, menu drawer visible from right |
| Settings | "הגדרות" header + section titles visible |
| Game/placement | Boards + dashed slots + hand cards |
| Reveal Modal | Big "Board N" + dots row + community face-up |
| Result/end | Winner indicator + advance button |

If a screen isn't covered, **flag it as unverified** in the report, don't assume it works.

## Mandatory checks per build

### A. Build identification

```
☐ Pink pill shows expected version (e.g., v2.7.0 b<N> • V21 • EMBED)
☐ build_history row exists with status=in_progress
☐ HEAD commit SHA matches the latest expected fix
```

### B. Home screen

```
☐ Single "CAPS POKER" title (no duplicate wordmark below)
☐ No fake "X שחקנים אונליין" text (unless real online data wired)
☐ Player count selector (2P/3P/4P) visible and toggleable
☐ Green PLAY button center stage
☐ Daily reward pill or streak info present
☐ No Sit & Go / Quick Poker buttons here (moved to side menu in b372+)
☐ Hand History card present (kept on home)
☐ Achievements + Missions cards present
☐ Disclaimer text at bottom
```

### C. Side menu (tap avatar top-right)

```
☐ Profile section: avatar + name + chip balance
☐ Game modes section: Play Online, Sit & Go, Quick Poker, Host, Join, Tournaments(disabled)
☐ Progress section: Stats, Leaderboard, Battle Pass(disabled), Coaching(disabled), Spectator(disabled)
☐ Disabled items show "(בקרוב)" suffix and reduced opacity (0.4)
☐ Settings & Tutorial section
☐ NO Hand History (moved to home only)
☐ NO Language toggle (moved to settings)
☐ Sign in/out at bottom
```

### D. Settings (tap ⚙️)

```
☐ Visual theme picker
☐ Orientation section
☐ Background theme
☐ Profile section
☐ Gameplay section: Player count, Bot difficulty, Reveal speed
☐ NO "Starting Chips" / "Pot Per Board" / "Complete Bonus %" rows (DEV-only)
☐ Home theme
☐ Button style
☐ Card design (theme + 4-color + colorblind + hand sort)
☐ NO TIMING section (DEV-only)
☐ NO BOT section (DEV-only)
☐ Audio & Notifications
☐ Tools (tutorial reset, onboarding, simulation)
☐ NO DEVELOPER section in production (DEV-only)
☐ Reset defaults button
☐ Danger zone
☐ Credits
```

### E. Game/placement phase (per mode)

For each of 2P/3P/4P modes:

```
☐ Correct number of boards stacked (4/3/2 respectively)
☐ Cards scaled appropriately (2 boards=1.0x, 3=0.85x, 4=0.69x)
☐ All boards visible without clipping at top/bottom
☐ "לוח N" label on each board
☐ "מסדר ←" indicator on currently-active board
☐ "מיקום אוטומטי" lightning button on active board
☐ Dashed gold slots visible on empty boards (distinct from face-down community)
☐ Community cards: 3 face-up + 2 face-down per board
☐ Hand strength hint visible per board
☐ Hand cards row(s) at bottom — NO clipping at left/right edges
☐ Card counter top-right shows X/N format
☐ "ביטול"/"אישור" floating actions appear when card placed (absolute, no flow impact)
☐ "אישור" disabled until all boards full
☐ "אישור" becomes "✓ מוכן" with green bg when ready
```

### F. Reveal phase

```
☐ Modal opens (full screen takeover)
☐ Big "Board N" header
☐ Score indicator above
☐ Dots row showing progress (filled = done, white = current)
☐ Single board displayed (slide animation between boards)
☐ Community cards reveal one by one
☐ Hand strength shown for player and bot
☐ Winner indicator
☐ Advance via tap or auto-advance
☐ Final summary after last board
```

### G. Hand cards layout (CRITICAL — has been bug-prone)

```
☐ 2P mode (16 cards): 8 cards per row × 2 rows, all visible
☐ 3P mode (12 cards): 8 + 4 split, all visible
☐ 4P mode (8 cards): single row of 8, all visible
☐ Edge cards (leftmost + rightmost) NOT clipped at screen border
☐ Cards aligned center horizontally
☐ "היד שלך" label + counter visible
```

### H. Color/visual quality

```
☐ Background dark maroon (#1C0508 or close), not pink
☐ Board surface darker maroon (#6B1520), brighter than bg
☐ Board border gold/brown (#8B6914)
☐ Cards warm cream (#FFFEF8), not pure white
☐ Suits: red for ♥♦, black for ♠♣ (NOT 4-color unless toggled)
☐ Gold accents (#c9a84c) on labels, controls
```

## Critical bugs that block status=live

If ANY of these appear, do NOT mark live:

1. App crashes on launch
2. PLAY button non-functional
3. Cards not dealing (game stuck after PLAY)
4. Reveal Modal doesn't open or freezes
5. Boards visibly clipped/overlapping in any mode
6. Hand cards clipped at edges in any mode
7. Currency/chips display NaN or undefined
8. Any Hebrew text shows as boxes/garbage characters

## Soft bugs (note but don't block)

- Cosmetic spacing off by a few pt
- Animation slightly janky on first run
- Single bot taking longer than usual
- Disabled items still show some hover effect

## After running checklist

Update `build_history`:

```sql
UPDATE build_history
SET status = 'live',
    deployed_at = NOW(),
    completed_at = <CI completion time>,
    notes = notes || ' [<timestamp> IL] Checklist passed: A,B,C,D,E,F,G,H all green.
                       Unverified: <list>. Soft issues: <list>.'
WHERE id = <id>;
```

Update `session_handoffs`:

```sql
UPDATE session_handoffs
SET current_build_live = 'b<N> (HEAD <sha>) — <one-line summary>',
    current_build_in_progress = NULL,
    outstanding_issues = jsonb_build_array(<unverified or soft issues>)
WHERE id = 1;
```

## Anti-patterns

1. **Don't approve based on 3 placement screenshots only** — at minimum need home, menu, settings, all 3 game modes
2. **Don't skip checks because "this build only changed X"** — regressions in unrelated areas are common
3. **Don't trust pill version blindly** — if pill shows b373 but DB has b372, investigate the counter discrepancy
4. **Don't mark live if Roye hasn't visually confirmed** — Claude can run checks but human eyes confirm

## Quick path: minimum viable approval

If Roye is short on time, the absolute minimum is:

```
1. Pill shows correct b<N>
2. Home screen renders
3. PLAY → game opens in chosen mode
4. Cards deal, can place at least one
5. Cancel/exit works without crash
```

This gets the build to `live` with a note: "Quick approval only, full checklist not run."
