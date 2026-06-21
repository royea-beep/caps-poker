# GEMS — caps-poker

> CAPS poker iOS/Android (Expo + Supabase).
> Living document of non-obvious lessons, gotchas, and patterns specific to this project.
> Created 2026-05-25 by DEEP-DISC standardization sweep. Empty sections are placeholders — fill as you hit them.

## How to read this file
Each entry is a single insight you would tell a teammate in chat — short, concrete, and specific. The format is:

```
### Title (date)
**Symptom:** what you observed
**Root cause:** what was actually wrong
**Fix:** what worked
**Lesson:** the principle to remember
```

## Where existing project lore lives (refresh as the project evolves)
- README.md — high-level overview
- PROJECT-INFO.json — machine-readable metadata
- PROJECT-RULES.md — invariants and "don't do this" rules
- CURRENT-STATE.md — what's live, what's in flight
- CLAUDE.md — agent context (loaded by Claude Code at session start)
- Empire memory pointers:
  - C:/Users/royea/.claude/projects/C--Projects/memory/MEMORY.md (look for entries tagged `caps-poker`)
  - Empire `empire_dashboards` + `connections_index` + `project_index` tables (vjxqlqtlywovnbidovit)

## GEMs to date

> Add new entries below as they happen. The empire standard is: one GEM per non-obvious fix or pattern.
> Cross-link to other projects by linking their GEMs.md path.


## GEM — Headless Visual-QA Loop (self-verification, no phone)
**Proven:** 2026-06-15 (app-wide theme sweep, 7 waves SWEEP-1 → CLOSE).
**What:** The strategist verifies the bot's UI work by running Playwright + Chromium against the LIVE web app (caps.ftable.co.il) — no device, no user screenshots.
**Recipe:**
1. Deep-link `/game` lands straight in placement (bypasses home/tutorial).
2. Board count: set `localStorage` `caps-poker-storage` → `.state.config.numberOfPlayers` (2 → bc4 / 16-card hand, 3 → bc3 / 12, 4 → bc2 / 8), reload `/game`.
3. Other screens via direct routes: `/play /settings /shop /profile /friends /cups /leaderboard /tournament /sit-and-go /hand-history /achievements /gameover /orientation-pick /multiplayer-game /lobby/host /lobby/internet-host /lobby/internet-join`.
4. Measure resolved colors via `getComputedStyle` (walk up to nearest non-transparent bg); build PIL contact-sheet montages for at-a-glance audit.
**Why it matters:** verifies RENDERED output, not bot self-reports. Across the sweep it caught a long string of false "DONE" / "no change needed" / "already clean" claims (friends, lobby ×2, hand-history, achievements, StarterOfferModal). Pattern: grepping `COLORS.gold` is never sufficient — most holdout gold is inline hex literals (`#FFD700`, `#c9a84c`, `#e8c96a`) or shared styles (Button.tsx variantGold). The `#c9a84c` overload: chrome used the TOKEN `COLORS.gold`, the winner uses the inline LITERAL `'#c9a84c'` — swap the token, keep the literal.
**Caveat:** web is a faithful proxy for layout + color (color tokens are device-agnostic, so native matches); NOT native-pixel-perfect for Dimensions-dependent layout.
**Note:** `web-deploy.yml` triggers on `fix/**` ~4-5 min after push, so the live web reflects the current branch.

---

### Instrument before hunting — an error message is a hypothesis, not a fact (2026-06-21)
**Symptom:** The hooks-crash ("Rendered fewer hooks than expected") was hunted statically for ~6 sessions on the assumption the text "accidental early return" named the real cause. The exhaustive static scan came back CLEAN; root cause stayed unfound.
**Root cause:** A production error message that *names* a cause was treated as fact. It was a hypothesis the static hunt could never confirm — and it misled the whole investigation.
**Fix:** Stop hunting; instrument. Make the next occurrence self-identifying — capture the real component chain (`component_stack`) into the DB — then read it off a live crash. (PR #35.)
**Lesson:** For intermittent/production bugs, an error message that names a cause is a hypothesis to FALSIFY, not a fact. Instrument-first (make the next occurrence self-reporting) BEFORE any static hunt — and verify the capture pipeline end-to-end before trusting it.

### componentStack lives ONLY in a React error boundary, and only the nearest one (2026-06-21)
**Symptom:** `crash_reports.component_stack` was always NULL for Game-screen render crashes, so the offending component could never be named. 35 crash rows at v2.7.0 in 7 days, 0 with a stack.
**Root cause:** Two parallel pipelines. The boundary that actually caught the crash — the in-game `ErrorBoundary` wrapping `<GameScreenInner/>` in `app/game.tsx` (the nearest ancestor, below expo-router's internal `Try`) — dropped `errorInfo.componentStack` and fed the `bug_reports` pipeline. The pipeline that *does* persist the column (`generateCrashReport` → `crash_reports`, via the shadowed `CrashBoundary` at `_layout:539`) never fired. The expo-router `ErrorBoundary` export (`_layout:90`) is stackless — it only receives `{ error, retry }`; expo-router's `Try` captures the stack internally and never forwards it.
**Fix:** Route `errorInfo.componentStack` from the in-game boundary to BOTH pipelines. No double-insert (`bug_reports` ≠ `crash_reports`). (PR #35.)
**Lesson:** Only a boundary's `componentDidCatch(error, errorInfo)` has `componentStack`; global `ErrorUtils.setGlobalHandler` and `console.error` patches NEVER do. The boundary must be the NEAREST ancestor of the throwing component (inside the screen, below expo-router's `Try`) or it is shadowed and the stack is lost. Audit any crash pipeline catch-site → every hop → the actual DB insert before trusting it.

### JS-only diagnostics/fixes ship via OTA, never a native build (2026-06-21)
**Symptom:** The plan nearly burned an Apple-quota native rebuild to get `keep_fnames` into the binary for readable `componentStack` names. 3 builds were already spent in a day (503 failed, 504, 505).
**Root cause:** Assumed component names come from the native binary. They come from the JS bundle's function names.
**Fix:** OTA-export from `main` (which has `keep_fnames`) carries readable names onto ANY installed build — including the 502/504 devices crashing now. GATE A proof: `grep` the exported Hermes `.hbc` for a known component name (`GameScreenInner`, `BoardReveal`, `CompleteOverlay`) — if present, names survived. GATE B: confirm OTA `runtimeVersion` (appVersion policy → `2.7.0`) matches the live builds; verify empirically via recent `crash_reports` rows at that version, not EAS (`eas build:list` is blind to GitHub-Actions builds and will false-alarm against a stale EAS build).
**Lesson:** `componentStack` / component names come from the JS bundle, not the native binary. Reserve native rebuilds (and Apple's ~10/24h upload quota) for genuine native changes. Verify `keep_fnames` by grepping the exported bundle before relying on it.

### Offload QA/repro to the strategist's sandbox; reserve executor context for edits (2026-06-21)
**Symptom:** Across 8 sessions the executor repeatedly re-read `game.tsx` (~1600 lines) and ran out of context (96–99%) after 1–2 reads + a handoff — enormous waste for a small fix.
**Root cause:** Source-independent reasoning and verification ran in the executor's context. An existing headless QA loop (Playwright vs `caps.ftable.co.il`) sat unused for 7 sessions.
**Fix:** Division of labor — the strategist (chat) does all source-independent reasoning and ALL QA/repro in its own sandbox; the executor's context is reserved for edits + `tsc`/`jest` + push. grep-first / read-targeted: locate the last-hook line / call sites / symbol instead of re-reading whole files.
**Lesson:** Run verification and source-independent reasoning off the executor's context. This alone prevents the multi-session context-exhaustion failure mode. See the Headless Visual-QA Loop GEM above — make it a standing per-session step.
