# Key Decisions — 2026-03-20

---

## Decision: Two Build Number System (Clarified)
**Date:** 2026-03-20 ~09:00 IL
**Context:** Roye said "Caps is more updated than build 104" — confusion between code builds and EAS builds
**Options considered:**
- A: Use only EAS build number (#117)
- B: Use only code build (b104)
- C: Maintain both — always reference both
**Choice made:** C — always reference both
**Reason:** EAS auto-increments for every build attempt (including failures/retries), so EAS #117 ≠ code b104. Both numbers are meaningful but measure different things.
**Impact:** All docs, MEMORY.md, and Claude context now always show both: "Code b104 | EAS #117". Documented as Architecture Decision.
**Related commits:** 1ba8f6e

---

## Decision: Token-Based Theme System (over CSS variables / hardcoded)
**Date:** 2026-03-20 ~10:00 IL (finalized from b103→b104)
**Context:** Building Classic + Five-O themes, needed scalable approach
**Options considered:**
- A: Hardcode color checks in each component (`visualTheme === 'fiveo' ? '#FFD700' : '#c9a84c'`)
- B: CSS variables (not reliable in React Native)
- C: TypeScript `ThemeTokens` interface with `getTheme()` function
**Choice made:** C — TypeScript token interface
**Reason:** Type-safe, refactoring-friendly, adding a 3rd theme requires only one object in visualThemes.ts
**Impact:** All 17 tokens defined per theme. Components receive token values, never check theme name directly. Worklet exception: hardcoded in Reanimated animated styles (worklets can't read React state).
**Related commits:** df46d51

---

## Decision: Vercel Web Deploy in iOS CI Workflow
**Date:** 2026-03-20 ~14:30 IL
**Context:** Web deploy was manual (`cd dist && vercel --prod --yes`)
**Options considered:**
- A: Keep manual
- B: Separate GitHub Actions workflow for web deploy
- C: Add web deploy step after TestFlight submit in existing `ios-testflight.yml`
**Choice made:** C — add to existing workflow
**Reason:** One workflow = one trigger. If iOS build succeeds, web should always be in sync.
**Impact:** Every push to main now deploys both iOS (TestFlight) and web (Vercel) automatically. Stage 4 (Setup) score: 19→20.
**Related commits:** 1966560

---

## Decision: Stage System Is 8 Stages (Not 11)
**Date:** 2026-03-20 ~13:00 IL
**Context:** Prompt assumed 11 stages based on ZPM design. Actual TypeScript enum has 8.
**Verified from:** `src/shared/types.ts` line 149: `concept | research | architecture | setup | development | content_assets | launch_prep | live_optimization`
**Impact:** All scoring and dashboards based on 8 stages. Total score is /160 (not /220).
**Related commits:** 4e7605e

---

## Decision: Conversation Archive System
**Date:** 2026-03-20 ~15:00 IL
**Context:** Sessions produce lots of context that gets lost between conversations
**Options considered:**
- A: Rely on MEMORY.md only
- B: Full conversation archive in docs/conversations/
**Choice made:** B — full archive
**Reason:** MEMORY.md has a 200-line limit. Session summaries, key decisions, and the TIMELINE deserve more space and structure.
**Impact:** `docs/conversations/` with per-date session summaries, key decisions, TIMELINE.md, and template for future sessions.
**Related commits:** (this commit)
