# Key Decisions — 2026-03-19

---

## Decision: UNLOCK Iron Rule 2 — Landscape Support
**Date:** 2026-03-19 ~10:00 IL
**Context:** Roye wants to play on TV/tablet in landscape mode
**Options considered:**
- A: Keep portrait-only (Rule 2 locked)
- B: Unlock Rule 2, add landscape layout
**Choice made:** B — unlock with explicit "UNLOCK Rule 2" command
**Reason:** Valid use case (TV play, tablet). User explicitly requested.
**Impact:** Added orientation picker (first-launch + Settings), expo-screen-orientation lock, full landscape 3-panel game layout.
**Related commits:** 20150b9

---

## Decision: Multi-Project WhatsApp Bot (One Edge Function)
**Date:** 2026-03-19 ~12:00 IL
**Context:** Claude-fix bot working for Caps. Question: one function per project or shared?
**Options considered:**
- A: Separate Edge Function per project (8 functions)
- B: Single function with keyword-based project routing
**Choice made:** B — one function, keyword detection
**Reason:** 8 functions = 8× maintenance. Keywords ("caps", "poker", "wingman") are distinct enough.
**Impact:** One deployment covers all projects. 8 repos get auto-fix capability from single WhatsApp number.
**Related commits:** 79cecde

---

## Decision: Pre-Calculate Results During Countdown
**Date:** 2026-03-19 ~13:00 IL
**Context:** Navigation to results screen had noticeable lag (~500ms) during hand calculation
**Options considered:**
- A: Show loading spinner on results screen
- B: Calculate during the mandatory 3-second countdown timer
**Choice made:** B — pre-calculate
**Reason:** The countdown is mandatory anyway. Running computation in `setTimeout(..., 0)` uses otherwise wasted time.
**Impact:** Zero-wait navigation to results. Locked as architectural pattern. Documented in REUSABLE-SKILLS.
**Related commits:** 7c86bb0

---

## Decision: Five-O Visual Theme
**Date:** 2026-03-19 ~15:00 IL
**Context:** Roye wants a police/detective aesthetic as alternative to classic casino
**Options considered:**
- A: Single theme (classic casino)
- B: Full theme system with Classic + Five-O
**Choice made:** B — token-based theme system
**Reason:** If building two themes anyway, build it right with ThemeTokens interface so future themes are trivial to add.
**Impact:** Full `VisualTheme` type, `ThemeTokens` interface, `getTheme()` function, first-launch picker, settings toggle. Architectural pattern documented in REUSABLE-SKILLS.
**Related commits:** df46d51

---

## Decision: SKIP App Store Track
**Date:** 2026-03-19 (explicit user instruction)
**Context:** Roye was asked about App Store submission
**Options considered:**
- A: Submit to App Store
- B: Skip — focus on TestFlight + web
**Choice made:** B — skip App Store
**Reason:** Not ready for public launch, focus on feature completion and private testing
**Impact:** App Store track suspended indefinitely. Never mentioned unless Roye explicitly says "resume App Store". Saved in memory as Iron Rule.
**Related commits:** N/A — documented in MEMORY.md
