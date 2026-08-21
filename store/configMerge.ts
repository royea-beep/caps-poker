/**
 * Persist rehydration merge — guarantees `config` is COMPLETE.
 *
 * Kept in its OWN dependency-free module (no zustand / AsyncStorage / RN imports) so it can be
 * unit-tested directly without loading the native store — same reasoning as cardThemeMigration.ts.
 *
 * THE PROBLEM. zustand's default persist merge is SHALLOW: a persisted `config` object REPLACES
 * the initial one rather than filling gaps. So a config that was written partially — an
 * interrupted write, a hand-seeded QA/capture fixture, a future field added to DEFAULT_CONFIG
 * that older devices never persisted — rehydrates with keys MISSING, and every arithmetic read
 * of a missing key yields NaN. Measured 2026-08-20: seeding `config` with five of its fifteen
 * keys dropped `potPerBoard`, and the results screen rendered "This session: NaN".
 *
 * WHY THAT MATTERS BEYOND ONE LABEL. `potPerBoard` alone is arithmetic in seven multiplayer
 * sites plus results / simulate / settings / game. Worse, app/game.tsx:621 computes the bot turn
 * delay as `botSpeedMin + Math.random() * (botSpeedMax - botSpeedMin)`; a missing `botSpeedMin`
 * makes that NaN, and a NaN timer delay coerces to 0 — bots would act instantly instead of
 * pacing. That is broken gameplay, not a cosmetic string. And where the NaN accumulates
 * (`practiceSessionNet + delta`) it is sticky for the rest of the session.
 *
 * WHY `merge` AND NOT `migrate`. The store already wires a `migrate` hook, which is the obvious
 * place to reach for and the wrong one: `migrate` runs ONLY when the persisted version differs
 * from the current version. A v1 store carrying a partial config never triggers it. `merge` runs
 * on EVERY rehydration, which is the actual requirement.
 *
 * WHY DEFAULTS ARE A PARAMETER. Importing DEFAULT_CONFIG here would pull
 * constants/gameConfig.ts -> ./theme -> paintThemes, which reaches react-native and would break
 * this module's dependency-free property. utils/handEvaluator.ts documents the same chain and
 * takes the same way out.
 */

/**
 * Layer the config three deep: defaults < the store's own initial state < what was persisted.
 *
 * Order is load-bearing. Defaults go FIRST so they only ever fill gaps — putting them last
 * would silently overwrite every deliberate user setting on every launch (a player who turned
 * sound off would find it on again, because DEFAULT_CONFIG.soundEnabled is true).
 *
 * @param persisted     the rehydrated slice, or null/undefined on a first run or a failed read
 * @param current       the store's initial state, including its actions
 * @param defaultConfig DEFAULT_CONFIG, injected to keep this module free of RN imports
 */
export function mergeGameStorePersisted(persisted: any, current: any, defaultConfig: any): any {
  const merged = { ...current, ...(persisted ?? {}) };
  merged.config = {
    ...(defaultConfig ?? {}),
    ...(current?.config ?? {}),
    ...(persisted?.config ?? {}),
  };
  return merged;
}
