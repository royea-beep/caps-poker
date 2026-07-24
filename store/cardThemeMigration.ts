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
export function migrateGameStorePersisted(persisted: any, _fromVersion?: number): any {
  if (persisted && persisted.cardTheme === 'v1') {
    return { ...persisted, cardTheme: 'v3' };
  }
  return persisted;
}
