/**
 * CN-E2 / AUDIT B — DEV-ONLY revealData override, so the celebration gate can be tested on
 * cases the dealer will not reliably produce.
 *
 * WHY THIS EXISTS. The celebration rule at app/results.tsx (the effect that sets
 * showWinOverlay, and the render condition) is:
 *
 *     revealData.isPractice ? playerWins > botWins : revealData.netChips > 0
 *
 * The RESTRAINT case — playerWins > 0 but playerWins < botWins, i.e. "won a board, lost the
 * hand" — is the one that proves the rule is restraint and not just "any win". Three sprints
 * tried to reach it by dealing hands. Eight dealt hands produced TIE GAME twice and never
 * produced it, because outcomes are dealt, not chosen. This makes it selectable.
 *
 * WHAT IT DOES NOT DO. It does not touch the gate. It substitutes the INPUT the gate reads,
 * one level above it, at the single site where the results screen pulls revealData out of the
 * store. Touching the gate would invalidate the very thing under test.
 *
 * WHY `__DEV__` AND NOT AN app_config FLAG. Every other kill/dev mechanism in this repo is
 * compile-time (utils/animationKill.ts consts, app/simulate.tsx's `if (!__DEV__) return`).
 * `__DEV__` is `false` in `expo export -p web` and in every store build, so this function is a
 * pass-through there and the fixture branch is dead code.
 *
 * WHY THERE IS A SECOND GUARD — MEASURED, 2026-08-08. `__DEV__` alone is UNREACHABLE on every
 * web surface that actually mounts, so a `__DEV__`-only harness could never have been run:
 *   - Metro web dev server (`expo start --web`, `__DEV__` true): #root stays EMPTY, hard page
 *     error `SyntaxError: Cannot use 'import.meta' outside a module`. The app never mounts.
 *     (Same blocker recorded 2026-07-10; still live, and this is its cause.)
 *   - `expo export -p web --dev`: emits an index.html with NO <script> tag at all and a 17KB
 *     stub whose hash is the MD5 of the empty string. Nothing to run.
 *   - `expo export -p web` (production): mounts — but `__DEV__` is false.
 * So the probe bundle is a PRODUCTION export built with EXPO_PUBLIC_CAPS_FIXTURE=1. Metro
 * inlines EXPO_PUBLIC_* at build time; the real release build (GitHub Actions / Vercel) does
 * not set it, so the comparison is `undefined === '1'` → false, the branch is dead, and the
 * shipped bundle behaves exactly as it does today. This variable exists ONLY for this probe
 * and must never be set in .env / .env.local / CI.
 *
 * HOW TO DRIVE IT. See tests/celebration-gate-probe.mjs:
 *     EXPO_PUBLIC_CAPS_FIXTURE=1 npx expo export -p web --output-dir web-fixture-dist
 * then install `globalThis.__CAPS_REVEAL_FIXTURE__` before page scripts run and open /results.
 *
 * NOTE: /results runs real economy writes (record_hand_net) for non-practice hands. The probe
 * blocks Supabase at the network layer so a fixture can never reach the live ledger.
 */

/**
 * Returns the DEV fixture if one has been installed on globalThis, otherwise the real value.
 * In production (`__DEV__ === false`) this is the identity function.
 */
export function applyDevRevealFixture<T>(actual: T): T {
  if (!probeEnabled()) return actual;
  const fixture = (globalThis as any).__CAPS_REVEAL_FIXTURE__;
  return fixture ? (fixture as T) : actual;
}

function probeEnabled(): boolean {
  return __DEV__ || process.env.EXPO_PUBLIC_CAPS_FIXTURE === '1';
}

/**
 * CN-CAPTURE — publish a read-side snapshot for the probe. NOT UI, and not a fallback path:
 * nothing in the app reads this back.
 *
 * It exists because "the field is typed and the writer runs" is not evidence that /results can
 * READ the captured value — that is the exact class of claim this project has shipped wrong
 * before. This lets the probe assert on what the results screen actually holds, without
 * rendering an equity UI (explicitly out of scope this sprint).
 *
 * Dead in the shipped bundle: same guard as the fixture override.
 */
export function publishProbeSnapshot(key: string, snapshot: unknown): void {
  if (!probeEnabled()) return;
  const g = globalThis as any;
  g.__CAPS_PROBE__ = { ...(g.__CAPS_PROBE__ || {}), [key]: snapshot };
}
