# Automated Debug System — Audit Report
**Date:** 2026-03-23 | Scope: Caps + Wingman

---

## VERDICT

**The "auto-test runner with screen recording + numbered commands" does NOT exist yet.**

What exists is:
- Caps: Manual tester guide (`testers.tsx`) + hand simulation (`simulate.tsx`) + basic log overlay
- Wingman: Advanced diagnostics (`debugLogger.ts`) + comprehensive Jest unit tests

Neither is a full automated E2E test runner.

---

## What Was Found

### CAPS

| File | What it is |
|------|-----------|
| `components/DebugOverlay.tsx` | On-screen log viewer (min/max). Exports `debugLog()`. NOT a runner. |
| `app/testers.tsx` | Manual beta checklist — 8 things to verify by hand |
| `app/simulate.tsx` | Batch hand simulation (100 hands, stats). Auto-mode runs N hands. |
| `utils/__tests__/*.test.ts` | 7 Jest unit tests (simulate, gameLogic, handEvaluator, QA stress, etc.) |

**Missing**: screen recording, numbered step executor, crash detection, E2E framework

### WINGMAN

| File | What it is |
|------|-----------|
| `apps/mobile/src/components/DebugOverlay.tsx` | Log overlay with `checkpoint(id, label)` markers |
| `apps/mobile/src/config/debug.ts` | `DEBUG.log/warn/error()` wrapper gated by `__DEV__` |
| `apps/mobile/src/services/debugLogger.ts` | **Most sophisticated** — error burst detection, perf tracking, event emitter, window.\_\_debug exports |
| `apps/mobile/src/__tests__/*.test.ts` | 20 Jest unit tests (security, pairingEngine, coinEngine, etc.) |

**`debugLogger.ts` is the closest thing to a "debug system":**
- Error burst detection: same error 3+ times in 30s → `emitIssue()` alert
- Performance: tracks durations, alerts on ops > 3000ms
- Global exports: `window.__debug`, `window.__debugSummary()`, `window.__debugErrors()`
- Auto-prints summary every 60s in dev mode
- **Still NOT a test runner** — no screen interaction, no step execution

---

## What's Missing for a Full Auto-Test Runner

| Component | Status | Effort |
|-----------|--------|--------|
| Numbered step executor (`runStep(1), runStep(2)...`) | ❌ | 4h |
| Screen recording (video of test run) | ❌ | 8h (native module) |
| Crash detection + recovery (auto-continue after crash) | ❌ | 6h |
| E2E framework (Maestro recommended for RN) | ❌ | 16h setup |
| CI integration (run E2E on every push) | ❌ | 4h |

---

## What CAN Be Reused Across Projects

From Wingman's `debugLogger.ts`:
- Error burst detection logic → copy to any project
- Performance tracker with sliding window → portable
- Event emitter pattern for `onLog/onIssue` → reusable

From Caps' `simulate.tsx`:
- Auto-mode pattern (auto-advance through steps) → template for step runner

---

## Recommendation

**If building a full system (priority: HIGH for App Store-bound apps):**

1. Use **Maestro** (maestro.mobile.dev) for E2E testing on React Native
   - Writes YAML test flows, runs on simulator/device
   - Can record screenshots at each step
   - Crash detection built in

2. Add Maestro `.flows/` directory to Caps + Wingman
3. Run in GitHub Actions on every TestFlight PR

**If quick win only (priority: LOW, 2h):**
- Extract Wingman's `debugLogger.ts` into `@royea/debug-logger` shared package
- Ship to Caps + 9Soccer (as web-only dev overlay)

---

## Architecture (What a Full System Would Look Like)

```
Push to main
     ↓
GitHub Actions (ubuntu-latest)
     ↓
Maestro Cloud or Emulator
     ↓
.flows/onboarding.yaml         ← Step 1: launch app
.flows/first_game.yaml         ← Step 2: play one game
.flows/leaderboard.yaml        ← Step 3: check leaderboard
     ↓
On crash: screenshot + stack trace saved as artifact
On pass: all screenshots uploaded → visual review
     ↓
Report posted as PR comment
```
