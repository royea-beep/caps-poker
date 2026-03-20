# Caps Poker — Architecture Decision Records (ADR)
**Date:** 2026-03-20 | **Format:** lightweight ADR

Each decision: Context → Options → Choice → Consequences

---

## ADR-001: React Native + Expo (not Flutter, not bare RN)
**Date:** pre-2026-03-18 | **Status:** LOCKED (Iron Rule 1)

**Context:** Need iOS + web from one codebase. Team is JS/TS.

**Options:**
- Flutter (Dart, excellent performance, separate web renderer)
- Bare React Native (full control, complex setup)
- **Expo managed workflow (chosen)**
- Capacitor + web app

**Decision:** Expo managed workflow.

**Consequences (+):** EAS Build handles all signing/certificates remotely. Expo Router gives file-based navigation. OTA updates possible. No Xcode required for most changes.

**Consequences (-):** `newArchEnabled: false` required (SDK 55 lib compat). Can't use native modules that need `pod install` without ejecting.

---

## ADR-002: newArchEnabled: false
**Date:** 2026-03-18 | **Status:** Active (revisit at SDK 56+)

**Context:** App crashing on iOS after READY button. Modal animations freezing.

**Options:**
- Fix each lib individually for New Architecture
- **Disable New Architecture globally**

**Decision:** `newArchEnabled: false` in app.json.

**Consequences (+):** All crashes resolved. Modal `entering=` animations work. react-native-reanimated stable.

**Consequences (-):** Missing New Architecture performance improvements. Must re-enable when SDK 56 ships with better lib support.

**Review trigger:** When expo-router, reanimated, gesture-handler all ship stable New Arch builds.

---

## ADR-003: Zustand + AsyncStorage persist (not Redux, not Context)
**Date:** pre-2026-03-18 | **Status:** LOCKED

**Context:** Need persistent game state across screens and app restarts.

**Options:** Redux Toolkit, React Context, MobX, **Zustand + persist middleware**

**Decision:** Zustand with `partialize` to select only persistent fields.

**Consequences (+):** Minimal boilerplate. `partialize` prevents stale multiplayer state from persisting. Type-safe selectors. Works with AsyncStorage on native and localStorage on web.

**Key pattern:** Always use `partialize` — only list fields that should survive app restart. Transient state (revealData, multiplayer state) is NOT included.

---

## ADR-004: expo-router file-based navigation
**Date:** pre-2026-03-18 | **Status:** LOCKED

**Context:** Need navigation across ~15 screens including sub-routes (/lobby/host, /lobby/join).

**Decision:** expo-router (file-based, Next.js-style).

**Key pattern:** `router.replace()` for one-way flows (game → results), `router.push()` for stacked nav. Never use `router.replace()` for back-navigation flows.

---

## ADR-005: rv() responsive value helper
**Date:** 2026-03-18 | **Status:** LOCKED (Architecture Decision)

**Context:** Components need different sizes on mobileWeb (W<500), tablet (500-1024), desktop (≥1024), native.

**Decision:** `rv(W, mobileWeb, tablet, desktop, native)` factory function.

**Critical rule:** Always call INSIDE component with `useWindowDimensions()`. NEVER at module level — crashes web (Dimensions not available during module init).

---

## ADR-006: Constants.expoConfig.extra (not process.env.EXPO_PUBLIC_*)
**Date:** 2026-03-18 | **Status:** LOCKED (Architecture Decision)

**Context:** BugReporter silently failing — Supabase URL undefined at runtime.

**Root cause:** `process.env.EXPO_PUBLIC_SUPABASE_URL` is undefined at RUNTIME in Expo managed workflow. Only available during build-time bundling.

**Decision:** All runtime config reads from `Constants.expoConfig?.extra?.supabaseUrl`.

**Consequence:** All secrets must be in `app.json` `extra` block AND in Supabase/EAS secrets for CI.

---

## ADR-007: Platform.OS === 'web' (not typeof window)
**Date:** 2026-03-18 | **Status:** LOCKED (Architecture Decision)

**Context:** `window.addEventListener` throwing on iOS.

**Root cause:** Hermes JS engine exposes a global `window` object on native — `typeof window !== 'undefined'` is `true` on iOS.

**Decision:** Always use `Platform.OS === 'web'` for web-only code paths.

---

## ADR-008: credentialsSource: remote in EAS
**Date:** 2026-03-18 | **Status:** LOCKED

**Context:** GitHub Actions CI failing — no local certificates.

**Decision:** `credentialsSource: "remote"` — EAS manages all iOS certificates in Expo cloud dashboard.

**Consequence:** No `.mobileprovision` or `.p12` files needed on any machine. Zero-maintenance CI.

---

## ADR-009: Visual Theme Token System
**Date:** 2026-03-20 | **Status:** LOCKED

**Context:** Need Classic + Five-O themes with clean switching.

**Options:**
- Hardcode conditionals per component (`theme === 'fiveo' ? A : B`)
- CSS variables (unreliable in RN)
- **TypeScript ThemeTokens interface + getTheme() function**

**Decision:** `ThemeTokens` interface with 17 tokens. `getTheme(null)` returns classic as safe default.

**Critical exception:** Reanimated worklets (animated styles) cannot read React state → hardcode token values in `useAnimatedStyle` callbacks.

---

## ADR-010: Two Build Number System
**Date:** 2026-03-20 | **Status:** Active

**Context:** Confusion between code b104 and EAS #117.

**Decision:** Always track and report BOTH:
- `extra.buildNumber` in app.json = **code build** (manually incremented, matches git commits)
- EAS auto-increment = **TestFlight build** (includes failed/retried builds, always higher)

**Rule:** All docs, MEMORY.md, commits always state both: "Code b105 | EAS #117"

---

## ADR-011: Pre-calculate During Countdown
**Date:** 2026-03-19 | **Status:** LOCKED (reusable pattern)

**Context:** 500ms lag navigating to results (hand evaluation cost).

**Decision:** `setTimeout(calculateHandResultsMulti, 0)` fires immediately when countdown starts (first player finishes). Results stored in `precalculatedResultsRef`. Navigation is instant.

**Pattern:** Any mandatory UX wait (countdown, animation, loading screen) is free compute time.

---

## ADR-012: Web Deploy via dist/ not web-dist/
**Date:** 2026-03-18 | **Status:** LOCKED (Architecture Decision)

**Decision:** `npx expo export --platform web --clear` → `node scripts/fix-web-html.js` → `cd dist && vercel --prod --yes`

**NEVER:** FTP, NEVER `web-dist/`, NEVER static mode (SPA only).

**Why:** `output: "single"` in app.json required for expo-router SPA. Static mode breaks client-side routing.
