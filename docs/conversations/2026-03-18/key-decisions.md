# Key Decisions — 2026-03-18

---

## Decision: Disable New Architecture
**Date:** 2026-03-18 ~14:00 IL
**Context:** App crashing on iOS, reveal sequence freezing inside Modal
**Options considered:**
- A: Fix each Modal animation individually
- B: Disable New Architecture globally (`newArchEnabled: false`)
**Choice made:** B — disable New Architecture
**Reason:** SDK 55 + many libraries (reanimated, gesture-handler) have incomplete New Arch support. Disabling globally is safer than per-component workarounds.
**Impact:** Stable iOS builds. All Modal animations work. Will re-enable when SDK upgrades libs.
**Related commits:** 6386b32

---

## Decision: Platform.OS over typeof window
**Date:** 2026-03-18 ~14:30 IL
**Context:** `window.addEventListener` throwing TypeError on iOS (Hermes has a global `window`)
**Options considered:**
- A: `typeof window !== 'undefined'`
- B: `Platform.OS === 'web'`
**Choice made:** B — always use `Platform.OS === 'web'`
**Reason:** Hermes JS engine on iOS exposes a global `window` object, making typeof check unreliable.
**Impact:** Locked as Iron Rule / Architecture Decision. All web detection uses this pattern.
**Related commits:** 3ca5b14

---

## Decision: BEST card — inline glow, not floating badge
**Date:** 2026-03-18 ~16:00 IL
**Context:** "BEST" indicator was a small floating badge separate from the card
**Options considered:**
- A: Keep floating badge
- B: Gold glow border directly on the matching card
**Choice made:** B — inline glow
**Reason:** Cleaner visual, easier to read, no z-index issues, more elegant UX
**Impact:** Locked design pattern for highlighting cards throughout the game
**Related commits:** e8ceb35

---

## Decision: Build WhatsApp→Claude→GitHub bot
**Date:** 2026-03-18 ~17:00 IL
**Context:** Roye wants to send voice notes to report bugs and get auto-fixes
**Options considered:**
- A: Traditional bug tracker (Linear, GitHub Issues)
- B: Email-based reports
- C: WhatsApp bot with full AI pipeline
**Choice made:** C — full WhatsApp bot
**Reason:** Zero friction for Roye — just send a WhatsApp message. Claude can analyze, fix, and deploy automatically.
**Impact:** Became a flagship feature. Extended to 8 repos. Includes image vision + audio transcription.
**Related commits:** 42f8708

---

## Decision: credentialsSource: remote in EAS
**Date:** 2026-03-18 (end of session)
**Context:** GitHub Actions CI failing — no local `.mobileprovision` on runner
**Options considered:**
- A: Upload .mobileprovision to GitHub secrets, inject in CI
- B: credentialsSource: "remote" — EAS manages certs in cloud
**Choice made:** B — remote credentials
**Reason:** No files to maintain, no rotation headaches, works across machines
**Impact:** Zero-config CI — any push to main triggers clean TestFlight build
**Related commits:** 667328a
