/**
 * Persist migration (version 0 -> 1), CARD-FACE MERGE (v3.2 ship).
 *
 * Kept in its OWN dependency-free module (no zustand / AsyncStorage / RN imports) so it can be
 * unit-tested directly without loading the native store.
 *
 * The card-face default flipped 'v1' -> 'v3' (constants/cardThemes.ts). Existing devices persisted
 * 'v1' — the OLD default; the Batch-B removal of the picker means nobody *chose* it — so move them to
 * 'v3' to get the upgraded face. Any other value ('v2', 'v3', or a deliberate future 'v1' Classic
 * opt-out) is left untouched. Spread preserves EVERY other persisted field (chips, streaks,
 * achievements); guarded against null so it can never throw and drop a rehydrate.
 */
/**
 * SETTINGS-STRIP (version 1 -> 2), 2026-08-21.
 *
 * Removing a control must not strand the value it wrote. Three settings lost their UI:
 *   revealSpeed      (Reveal Speed row)   · config
 *   boardRevealDuration / turnRevealDelay (ADVANCED steppers, same two values) · config
 *   handSortMethod   (Card Sort row)      · top level
 * A player who had chosen "cinematic" or "pairs" would otherwise keep it forever with no way back.
 * Normalise those keys to the shipped defaults so everyone lands on the same, chosen-by-us value.
 *
 * DEFAULTS ARE IMPORTED, NEVER RETYPED HERE (Iron Rule #3) — if gameConfig changes, this follows.
 * Anything else in `config` is preserved: only the four orphaned keys are touched.
 */
import { DEFAULT_CONFIG } from '../constants/gameConfig';

const ORPHANED_CONFIG_KEYS = ['revealSpeed', 'boardRevealDuration', 'turnRevealDelay'] as const;

export function migrateGameStorePersisted(persisted: any, _fromVersion?: number): any {
  if (!persisted) return persisted;
  let next = persisted;

  if (next.cardTheme === 'v1') next = { ...next, cardTheme: 'v3' };

  // handSortMethod: the row is gone, so re-pin it to the default.
  if (next.handSortMethod !== undefined && next.handSortMethod !== 'caps') {
    next = { ...next, handSortMethod: 'caps' };
  }

  // The three config keys whose controls were removed.
  if (next.config && typeof next.config === 'object') {
    const patch: Record<string, unknown> = {};
    for (const k of ORPHANED_CONFIG_KEYS) {
      const shipped = (DEFAULT_CONFIG as Record<string, unknown>)[k];
      if (shipped !== undefined && next.config[k] !== shipped) patch[k] = shipped;
    }
    if (Object.keys(patch).length) next = { ...next, config: { ...next.config, ...patch } };
  }

  return next;
}
