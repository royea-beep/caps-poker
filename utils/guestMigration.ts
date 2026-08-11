/**
 * guestMigration — S85 Soft Registration
 * When a guest signs in for the first time, migrate local data to Supabase user_profiles.
 * Safe to call multiple times — no-ops if profile already exists.
 */
import { getSupabase } from './supabase';
import { useGameStore } from '../store/gameStore';
import { debugLog } from '../components/DebugOverlay';

export async function migrateGuestToUser(userId: string, playerName: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  try {
    // 409 FIX 2026-08-11 — this was a check-then-insert race (TOCTOU). It SELECTed, then
    // INSERTed; two concurrent callers both saw no row, both inserted, and the second got a
    // 409 unique violation on the primary key. The header's "safe to call multiple times"
    // claim was true only when the calls were serialised, which navigation does not guarantee.
    //
    // Roye saw a red 409 on /game, /results AND /settings for exactly this reason: every
    // navigation re-runs the sign-in path, and an established account already has the row.
    // A fresh anonymous device never reproduces it — the insert simply succeeds with 201,
    // which is why four probe runs and 56 automated checks all came back clean.
    //
    // upsert + ignoreDuplicates makes it genuinely idempotent in ONE round trip: no race
    // window, and it preserves the original "don't overwrite an existing profile" intent.
    const store = useGameStore.getState();

    const { error } = await sb.from('user_profiles').upsert({
      id: userId,
      display_name: playerName,
      chips: store.chips,
      total_played: store.handsPlayed,
      total_won: store.handsWon,
      best_win: store.biggestWin,
    }, { onConflict: 'id', ignoreDuplicates: true });

    // The old bare `catch {}` swallowed the 409 AND any genuine failure identically, which is
    // why this went unheard for so long. Surfacing it to the log keeps sign-in unblocked while
    // making a real failure visible.
    if (error) {
      debugLog(`[guestMigration] upsert failed: ${error.message}`, 'warn');
      return false;
    }
    return true;
  } catch {
    // Silent — never block sign-in flow
    return false;
  }
}
