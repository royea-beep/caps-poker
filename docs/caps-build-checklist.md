---
name: caps-build-checklist
description: Use whenever a new CAPS Poker build (b<N>) lands on TestFlight and the user wants verification, or whenever Claude is about to declare a build live. (It must NOT write build_history to do that — see "After running checklist".) Activates on phrases like "b372 הגיע", "b373 לבדיקה", "build is live", "אישרת את ה-build". Provides the full QA checklist that should run on every build before it's considered stable.
---

# CAPS Poker — Per-Build QA Checklist

## Purpose

Every build needs the same baseline checks. Without a fixed list, regressions slip through. This skill is the canonical checklist. Run it (or guide Roye through it) before flipping any build to status=live.

## When to invoke this skill

- Roye says "b<N> הגיע" or "b<N> לבדיקה" or sends new screenshots
- Claude is about to declare a build live — read `get_live_build()`; do NOT UPDATE `build_history`
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

## Current architecture — CORRECTED 2026-08-08 (was written at b372/b373)

This block exists because the checklist below was drifting into fiction. Verify against these,
not against memory of the b372 app.

| fact | current truth |
|---|---|
| Home screen | **`app/(tabs)/index.tsx`** (110KB). ⚠️ CORRECTED 2026-08-08 — an earlier revision of this table claimed home was `app/index.tsx` and that `(tabs)/index.tsx` was dead. **`app/index.tsx` DOES NOT EXIST.** That claim came from a brief and was written here without being checked; CLAUDE.md also names `app/(tabs)/index.tsx` as Home. Verify before repeating. |
| Layout direction | **LTR IS DELIBERATE.** `app/_layout.tsx:20-21` calls `I18nManager.allowRTL(false)` and `forceRTL(false)`, so the layout stays LTR even on a Hebrew device. Hebrew text is **right-aligned within an LTR layout** — a mirrored layout is NOT the target and must not be reported as a bug. |
| Card rendering | `Card.tsx` has **three** branches: faceDown, **V2 Minimalist (ACTIVE — `cardConfig.card_layout === 'v2'`)**, Classic (dead). Any card check must name the branch it exercises. |
| Reveal | `BoardReveal` is a **Modal showing ONE board at a time** via `currentIdx`. NOT a scroll. A "half screen / scrolling" report during reveal is a **placement-phase** symptom, not a reveal bug. |
| Reveal transition | **INSTANT swap**, not a slide. The slide was removed (VAMOS-FIX-REVEAL-TRANSITION-V2) because it passed through opacity 0 and flashed black. |
| Layout | **STACKED-ONLY** at every board count. Scale ladder 2 boards = 1.0× / 3 = 0.85× / 4 = 0.69×. Community card height floor **50pt**. **4 boards is a hard max.** |
| Board count | **DYNAMIC**: 2 players = 4 boards, 3 = 3, 4 = 2. Four cards per board per player, 5 community per board, one 52-card deck, max 4 players. Never hardcode. |
| Practice mode | **XP-ONLY. No chips move.** COMPLETE pays **200 XP** (`BATTLE_PASS_CONFIG.xpPerComplete`), NOT chips. **Any chip or "+50% bonus" figure shown in practice is a bug.** |
| Build number | Settings reads the **native** build (`Application.nativeBuildVersion`). `app.json` `extra.buildNumber` is deliberately left stale — **never use it as a source of truth.** |
| `build_history` | **HISTORICAL ONLY.** Last write 2026-05-08; builds 452-508 absent; row `451` stuck `in_progress`. Do NOT gate anything on it and **do NOT write to it** — the "After running checklist" section below used to tell you to, which is exactly how a dead table kept looking alive. **For the live build call `get_live_build()`**, which derives it from what devices report. If you must read `build_history` at all, read it **by `started_at`, never by `build_number`**: the testflight and production profiles ran independent number series, so `max(build_number)` and `max(started_at)` are different rows. |
| Palette | The "dark maroon" values in section H are **STALE**. Live theming is per-theme felt (classic green `#10281A`→`#0E2418`, fiveo maroon) resolved through `constants/paintThemes.ts`. Judge contrast and legibility, not a specific hex. |

**Marking convention below:** `[CODE]` = verifiable by reading code or querying the DB, no device
needed. `[DEVICE]` = requires a physical phone; these are the ones a human must run.

## `crash_reports` — the real numbers, CORRECTED 2026-08-08

Queried directly, whole table, no date filter:

| figure | value |
|---|---|
| rows total | **251** |
| `dirty-shutdown` rows | **135** — not 3. The "3" came from a query filtered to 45 days and grouped by a truncated `error_message`, which split one cluster into many. |
| browser-autoplay noise (`play() interrupted…`) | 50 — web-only, not a device signal |
| everything else | 66 |
| status | **all 135 dirty-shutdown rows are `dismissed`**, and all 135 carry an `error_stack` |
| `device_id` | **NULL on all 135** — affected-device count is unknowable, and these rows can never be attributed. The G2 build identifier fixes this going forward only. |

**135 IS NOT 135 CRASHES.** `dirty-shutdown` is reconstructed on the *next* launch from a
`step_log` that was never closed. A user force-quitting from the app switcher and an iOS
background kill produce exactly the same row as a real native crash. An unknown share of the
135 is noise — quoting 135 as confirmed crashes is a different error, not a correction.

Two clusters are not shaped like noise and are worth chasing (repro steps: part ו' of
`docs/qa/device-pass-508.md`):

| cluster | rows | window | note |
|---|---|---|---|
| `Splash` / `-> Splash` | 83 | 2026-03-24 → 2026-06-21 | 92 of the 135 have **≤2 steps** logged |
| `Game` / `deal_pressed` | 19 | 2026-04-03 → 2026-06-22 | one specific point in the flow, not a spread |
| `Home` / `-> Home` | 21 | 2026-03-26 → **2026-07-23** | the ONLY cluster still appearing after June |

**Do not read the June cut-off as "fixed."** The Splash and `deal_pressed` clusters stop on
21–22 June while Home continues to 23 July. A fix and an instrumentation change that stopped
the detector firing look identical from this table. Unresolved.

Superseded: `2026-03-28_0619_CAPS_caps-bible-audit.md` records "74 reports, all false
positives". The count has since grown to 251/135, and that document's claim that a DB trigger
auto-dismisses dirty-shutdown does not hold today — `crash_reports` currently has **no
triggers at all**, so "all dismissed" is not evidence of automated triage.

## Mandatory checks per build

### A. Build identification

```
☐ [DEVICE] Settings → Version row shows the NATIVE build number (not "EAS 330")
☐ [CODE]   The commit the build was made from — read the checkout SHA from the GitHub
           Actions run log, NOT from app.json. Build 508 was 5205bd2, not the app.json bump.
☐ [CODE]   List commits on the branch NOT in the build, so known gaps are not filed as bugs:
           git log --oneline <build-sha>..main
```

REMOVED 2026-08-08: the "pink pill" no longer exists, and `build_history` is dead — a row
there proves nothing and writing one revives a table that lied for three months.

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
☐ [DEVICE] Modal opens (full screen takeover)
☐ [DEVICE] Big "Board N" header
☐ [DEVICE] Score indicator above
☐ [DEVICE] Dots row showing progress (filled = done, white = current)
☐ [DEVICE] ONE board displayed at a time, swapped INSTANTLY (no slide, no black flash,
           no scrolling — scrolling here means you are still in placement)
☐ [DEVICE] Community cards reveal one by one
☐ [DEVICE] Hand strength shown for player and each opponent
☐ [DEVICE] Winner indicator
☐ [DEVICE] Advance via tap; long-press exits the whole reveal (builds after db8038c only)
☐ [DEVICE] Final summary after last board
☐ [CODE]   Practice: NO chip figure anywhere in the reveal (counter, flying chips, pot line)
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
☐ [DEVICE] Felt reads as the SELECTED theme's colour (classic = deep green, fiveo = maroon)
           and is visibly darker than the board panels sitting on it
☐ [DEVICE] Board panels are distinguishable from the felt at arm's length
☐ [DEVICE] Cards warm cream (#FFFEF8), not pure white
☐ [DEVICE] Suits: red for ♥♦, black for ♠♣ (NOT 4-color unless toggled)
☐ [DEVICE] Gold accents on labels/controls, legible against the felt
☐ [DEVICE] Nothing reads PINK. Colours look 2-3x lighter on screen than in a hex picker.
```

The old fixed hexes (#1C0508 / #6B1520 / #8B6914) were REMOVED 2026-08-08: theming is now
per-theme via `constants/paintThemes.ts`, so a single expected hex is wrong for most themes.
Judge contrast and legibility instead.

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

**DO NOT UPDATE `build_history`.** This section used to hand you an `UPDATE build_history SET
status = 'live'` — while the reference table 190 lines above already declared the same table dead.
That contradiction is not hypothetical: on 2026-08-28 a session read the table in good faith and
reported build **471** as live while Roye's phone ran **508**, and the 21:00 digest had been
repeating 471 for **123 consecutive nights**.

The table is historical. Writing to it now would restore the exact illusion that caused the
incident — a hand-maintained row that looks authoritative and silently ages out.

**The live build is not something you record. It is something you observe:**

```sql
SELECT get_live_build();
-- {"build_number": 508, "version": "2.7.0", "devices": 81, "stale": false,
--  "source": "device telemetry (analytics_events.native_build)"}
```

It reads `Application.nativeBuildVersion` as reported by installed binaries, so it cannot go stale
the way a hand-fed table did, and when it has nothing to go on it returns `build_number: null` with
a note instead of a confident wrong number. Every build reader delegates to it:
`get_current_build`, `get_build_changelog`, `run_daily_digest`, `get_daily_digest`,
`get_live_dashboard`, `get_caps_launch_dashboard`, `auto_dismiss_stale_crashes`.

`app_config.current_build` (465) and `app_config.next_build_number` (466) are **dead keys** for the
same reason. No reader uses them. Do not "fix" them by typing 508 in — that is how they got wrong.

If a build record with changelog and commits is wanted again, it must be **written by CI**, not by
a person: one step in `ios-testflight.yml` calling `register_build()`. A record only a human
maintains is a record that stops.

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
