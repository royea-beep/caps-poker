/**
 * guestMigration — S85 Soft Registration
 * When a guest signs in for the first time, migrate local data to Supabase user_profiles.
 * Safe to call multiple times — no-ops if profile already exists.
 */
import { getSupabase } from './supabase';
import { useGameStore } from '../store/gameStore';

export async function migrateGuestToUser(userId: string, playerName: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  try {
    // Check if profile already exists (previously signed in)
    const { data: existing } = await sb
      .from('user_profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (existing) return false; // Already migrated — don't overwrite

    // Read current local game state
    const store = useGameStore.getState();

    await sb.from('user_profiles').insert({
      id: userId,
      display_name: playerName,
      chips: store.chips,
      total_played: store.handsPlayed,
      total_won: store.handsWon,
      best_win: store.biggestWin,
    });

    return true; // Migration happened
  } catch {
    // Silent — never block sign-in flow
    return false;
  }
}
