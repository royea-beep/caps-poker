/**
 * ANIMATION KILL SWITCH — and the record of the bisect that created it.
 *
 * ORIGIN: `c1f5f2d`, 2026-03-22 — *"fix(crash): KILL switch — disable all withRepeat(-1)
 * animations for crash bisect"*. Its own message set the plan: **"Phase 4: set one flag to
 * false at a time in animationKill.ts to find culprit."**
 *
 * PHASE 4 WAS NEVER RUN. No commit between 2026-03-22 and 2026-08-07 concludes the bisect,
 * names a culprit, or re-enables anything. Every flag stayed `true` for four and a half
 * months, so a whole class of animation was dark and nobody had written down why.
 *
 * THE CRASH IT WAS ISOLATING is documented in `docs/caps-project-map.md` under NEVER:
 *   - "Use ConfettiCannon or CompleteOverlay (Hermes kill — too many animated views)"
 *   - "Use withRepeat(-1) in Reanimated (infinite loops crash Hermes)"
 * i.e. a HERMES engine kill, from too many concurrent animated views and from INFINITE
 * repeats. `react-native-confetti-cannon` was removed as a dependency two days later
 * (`8787750`).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * PHASE 4, RUN ON WEB — 2026-08-07
 *
 * Of the twelve original `withRepeat` sites only SIX survive, across three components, and
 * only ONE of those is the infinite `withRepeat(-1)` the switch was actually built for. The
 * other five use finite counts (200 / 100 / 20) — they were swept up by a blanket sweep, not
 * because they matched the suspect profile.
 *
 * The original bisect stalled because a Hermes crash needs a native build to observe, and
 * native builds have been unavailable. The WEB build does not use Hermes at all, so the five
 * finite gates can be re-enabled there for free. That is what the Platform check below does.
 *
 * ⚠️ WEB-SAFE IS NOT HERMES-SAFE. Running clean on web says nothing about the native engine
 * that produced the original crash. These stay KILLED on native until a device says
 * otherwise. Do not "simplify" the Platform check away.
 *
 * STILL OFF EVERYWHERE: `KILL_ProQuoteBanner`. It is the only `withRepeat(..., -1, true)` left
 * in the app and therefore the only site matching the documented cause. It goes last, and only
 * on native evidence.
 */

/**
 * PHASE 4 RESULT — INCONCLUSIVE, AND THEREFORE REVERTED TO KILLED.
 *
 * The web re-enable was shipped and measured on live (bundle
 * index-04a1ace7e92747c56ba17485765a1b31). With `KILL_Board` false on web, the empty slot's
 * opacity was sampled 23 times over 2.3s at 375 with the placement screen up: it read exactly
 * 0.600 every time and never moved. The pulse did NOT come back.
 *
 * 0.6 is ambiguous by construction - it is BOTH the `else`-branch resting value AND the
 * `useSharedValue(0.6)` initial - so three explanations survive and none was eliminated:
 *   1. `isArrangement` was false at sample time (it IS passed, as isArranging),
 *   2. Reanimated's withRepeat never started on web,
 *   3. Reanimated drives it somewhere `getComputedStyle` does not observe.
 *
 * So the flag is back to killed. An unverified animation re-enable, shipped before a tester
 * round, on a machine that cannot run a compiler twice, is the sequencing this whole switch
 * exists to avoid - and "I could not observe it" is not "it is safe".
 *
 * WHAT THE NEXT ATTEMPT NEEDS: an instrument that can see Reanimated's applied value on web
 * (or a device), and a way to distinguish the three cases above BEFORE flipping anything.
 * Setting the useSharedValue initial to a distinctive number would separate case 1 from 2/3
 * in a single measurement.
 */
const KILL_FINITE_ON_THIS_PLATFORM = true; // was `Platform.OS !== 'web'` — see above, reverted

/** TimerController — countdown scale pulse (1 → 1.12, withRepeat 100) and the final-3s opacity flash (withRepeat 20). */
export const KILL_game = KILL_FINITE_ON_THIS_PLATFORM;

/** Board — empty-slot pulse, board-`active` pulse, `isWinner` pulse. All withRepeat(200). */
export const KILL_Board = KILL_FINITE_ON_THIS_PLATFORM;

/**
 * ProQuoteBanner — speaker pulse while a quote plays. `withRepeat(..., -1, true)`.
 * THE ONLY INFINITE REPEAT LEFT. Stays true on every platform. See the header.
 */
export const KILL_ProQuoteBanner = true;

// PR-C 2026-05-24: b153 visual restore. `false` = NOT killed.
// All driving animations are FINITE (withRepeat(N)), never -1.
export const KILL_HeroParticles = false;
export const KILL_HeroGlow      = false;

// DELETED 2026-08-07 (Phase 4 cleanup) — every one of these had ZERO usage sites, so the flag
// was a comment pretending to be a control:
//   KILL_index, KILL_results, KILL_CompleteOverlay — no importer anywhere in the app.
//   KILL_Card    — the float loop it gated was REMOVED outright on 2026-05-22; Card.tsx still
//                  carries three comments pointing here, which is the correct residue.
//   KILL_HeroFan — the fan is a static layout by spec; it has no animation to kill.
// If you are looking for one of those names in git history, this is where it went.
