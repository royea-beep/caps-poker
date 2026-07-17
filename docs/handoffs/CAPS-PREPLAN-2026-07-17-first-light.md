# CAPS THEME — CORRECTED PREPLAN (expert-panel, 2026-07-17)

> **THIS IS THE CURRENT PLAN.** It SUPERSEDES the sequencing in
> `CAPS-STATUS-2026-07-17-routing-next.md` (whose "DEV-BUILD DEFAULT FLIP" is
> DISPROVEN — see step 3) and in `CAPS-STRATEGIST-HANDOFF-2026-07-16-1537.md`.
> Where any of them disagree, **this doc wins**. The other two remain valid for
> STATE, architecture, rulings, landmines, and debt.

## THE REFRAME
Roye's goal was never "a theme system" — it was good graphics visible on his phone. After many sessions there is ZERO visible change (correct and safe, but that's what he sees). The panel's correction: optimize for TIME-TO-VISIBLE, not architectural completeness.

## MILESTONE CORRECTION
OLD (wrong) milestone: "all surfaces themed." NEW milestone: **"Board, on Roye's device, fully Street Stencil."** Everything else defers behind this.

## WHY IT'S BEEN INVISIBLE (honest)
The entire delivery pipeline was built safely FIRST (paint layer, streetStencil theme registered, all Board tokens chosen/approved/shipped). That part is DONE and live (code shipped at main b3bf09a). What remains before colour is small and specific. The slowdown was context-exhaustion handoffs + meta-artifact overhead (phantom files, stale counts), not the safety checks (those are fast).

## COMPRESSED PATH TO FIRST LIGHT — branch-based, merge OFF the critical path
**KEY INSIGHT:** the dev build compiles FROM A BRANCH, not main. So merge is NOT between Roye and his first look. Do the work on one branch, dev-build from it, let Roye eye-test, THEN merge with full verify. This cuts two verify cycles off the critical path AND catches eye-test problems before main, not after.

### 1. Board ROUTING — before-audit first
Prove Board uses `getTheme(visualTheme)` NOT `usePaint` (DEFAULT_PAINT_THEME='streetStencil' armed). Enumerate routable occurrences as a table (counts = smoke alarms, re-derive, never target). Route all occurrences. Commit to branch — **do NOT merge yet**.

### 2. Board PANEL + LITERALS — same branch
Theme panel to N8 concrete (currently OBSIDIAN.* near-black), kill old gold `#c9a84c` literals (fighting new `#F8C020`), clear stray mint/`#FFD700`.

This batch **COLLAPSES pin+route into one** (departs from pin-first/route-second) — allowed ONLY with these guards, stated:
- **(a) SAFE-STOP VALVE** — short on context → merge/keep PINS-ONLY, NEVER a half-route (half-route = 1a failure shape).
- **(b) MANDATORY classic/fiveo byte-identity assertions** on every touched key, proving legacy themes unmoved before any routing in the same batch.

If either guard looks shaky at audit, split back into two batches — the valve makes that a safe fallback.

### 3. DEV-BUILD from the branch, with a BRANCH-ONLY picker edit
→ Roye's first on-device Street Stencil look.

**PREREQUISITE — SEPARATE DEV BUNDLE ID (do this BEFORE the dev build):** the `development` eas profile currently shares bundle id `com.capspoker.app` with prod → dev build shares AsyncStorage (`caps-poker-storage`) with Roye's real app. If he selects streetStencil in a shared-storage dev build, the PERSISTED value (`gameStore.ts:317`) leaks: after routing OTAs to prod, his prod app reads the same storage, `getTheme('streetStencil')` resolves (live since 1a) → **PROD paints Street Stencil on his device**. Structural dormancy silently false on the one device that matters.

- **FIX-REAL:** give `development` its own id `com.capspoker.app.dev` → separate storage domain, dev build can NEVER touch prod state, safe for THIS and every future eye-test. Costs a rebuild + provisioning; worth it (this is the 3rd dev-vs-prod concern).
- **BELT** (until dev id is confirmed separate): explicit Roye device step — switch picker back to CLASSIC before any prod install replaces the dev build (re-persists 'classic'). Free safety net, but manual/fragile — FIX-REAL is the real answer.

**TWO BENIGN SIDE-EFFECTS of the separate dev id** (state to Roye, not blockers):
- (a) the dev app starts **BLANK** — fresh anon user, welcome bonus, no chips/stats. This is PROOF the isolation works (dev can't see prod state → can't corrupt it); his real progress is safe in the prod domain. The dev build is a clean sandbox, not his account.
- (b) no eas.json profile sets `environment`, so the dev build hits the SAME Supabase as prod → the eye-test creates ONE phantom leaderboard/device row. Expected, one row, benign — don't mistake it for a leak later. (Pointing dev at a Supabase branch would zero this out but is over-engineering for a visual eye-test.)

**MECHANISM (a default flip does NOT work):** `_layout.tsx:248` seeds only `if (visualTheme === null)`; `gameStore.ts:317` PERSISTS visualTheme. Roye's device has 'classic' persisted → default change silently ignored. **Do NOT wipe storage** (destroys chips/stats). INSTEAD add streetStencil to picker options at `settings.tsx:844-847` (≈3 lines, branch-only); Roye MANUALLY selects it → works on his install, A/B classic ↔ streetStencil live, doubles as S77 preview.

### 4. THEN merge routing + literals to main with full verify — NOT the picker edit
**GUARD (non-negotiable):** the `settings.tsx` picker edit stays BRANCH-ONLY. If it reaches main, streetStencil becomes selectable in prod and STRUCTURAL DORMANCY is lost. Structure the branch so the picker edit is a SEPARATE, EXCLUDABLE commit (or reverted before merge). Merge brings routing + literals ONLY. After merge, verify `settings.tsx` picker options on main are still literal `[classic, fiveo]`.

## HARD SAFETY (non-negotiable, but fast)
- Confirm `getTheme` (not `usePaint`) before routing — or prod paints unintentionally.
- Panel+literals coherent BEFORE the dev build — or the "wow" shows a broken mix.
- Dev-build visibility is via a BRANCH-ONLY picker edit (`settings.tsx:844-847`), NOT a default flip (persisted 'classic' overrides the seed at `_layout.tsx:248`). NEVER wipe storage to force it (destroys Roye's chips/stats).
- The picker edit must NOT reach main (would break structural dormancy). Keep it a separable/revertible commit; verify main's picker options stay `[classic, fiveo]` after merge. Both already identified; neither optional.

## AUDITS STAY — ARTIFACTS GO (corrected)
The slowdown was NOT the audits — it was meta-artifact churn (phantom files, stale counts carried between sessions). The audits are what CAUGHT the fiveo-only traps (textSecondary→mint, textPrimary→white-on-fiveo) that a classic-or-streetStencil eye-test would sail right past — invisible to Roye's eye, real for fiveo users. So: **KEEP every audit and byte-identity assertion; CUT the artifact overhead.** Do not "speed up" by skipping verification — speed up by not generating handoff churn mid-batch.

## DEFERRED (real, but NOT between Roye and first light)
Home/Results/Win/Matchmaking/Settings painting; Settings 4→1 unification; vibration+language; the switcher UI (S77); the other 3 themes (S78+); QA/perf gate (S80); RETIRE-LEGACY. All AFTER Roye has seen Board Street Stencil on device.

## EXECUTION DISCIPLINE (to stop the overhead that's been invisible to Roye)
- One focused fresh session per step; before-audit-first; don't generate meta-artifacts mid-batch.
- Counts are smoke alarms, re-derived from the table, never carried.
- Verify every bot report against DB + live bundle before merge.
- Compress: routing → literals → flip is ideally 1 session each, not 5. Roye sees colour in the NEXT working session's arc, not a distant horizon.

## STATE (live, verified 2026-07-17)
main **2363bb3** (docs commit; zero code diff since b3bf09a) · bundle **index-d72ec102** · OTA **1f8994a2** · build **2.7.0 / ios 330 / android 90** unchanged · gate `premium_theme_enabled` ABSENT · default classic · streetStencil dormant+unrouted. All Board streetStencil token values shipped and real (0 TODO).

Committed docs: `docs/handoffs/` (this PREPLAN + STATUS + HANDOFF-with-banner), `prompts/VAMOS-CAPS-S76-BOARD-PIN-GO-2026-07-17-0042.md` (shipped — do not re-run).

SETTINGS AUDIT findings were chat-only, never filed — re-run the read-only audit when settings work begins; do not reconstruct from memory. (Its prompt `VAMOS-CAPS-SETTINGS-AUDIT-2026-07-17-0023.md` does NOT exist — write a fresh one.)
