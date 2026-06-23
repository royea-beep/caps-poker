import AsyncStorage from '@react-native-async-storage/async-storage';
const SecureStore = {
  getItemAsync: (key: string) => AsyncStorage.getItem(key),
  setItemAsync: (key: string, value: string) => AsyncStorage.setItem(key, value),
};
import { Platform } from 'react-native';
import { getSupabase, isSupabaseConfigured } from './supabase';

const DEVICE_ID_KEY = 'caps-device-id';

let _deviceId: string | null = null;

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return AsyncStorage.getItem(key);
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return AsyncStorage.getItem(key);
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') { await AsyncStorage.setItem(key, value); return; }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    await AsyncStorage.setItem(key, value);
  }
}

/** Get or create a stable device ID, stored in SecureStore (AsyncStorage on web) */
export async function getDeviceId(): Promise<string> {
  if (_deviceId) return _deviceId;
  try {
    const stored = await secureGet(DEVICE_ID_KEY);
    if (stored) {
      _deviceId = stored;
      return stored;
    }
    const id = 'xxxx-xxxx-xxxx'.replace(/x/g, () =>
      Math.floor(Math.random() * 16).toString(16)
    );
    await secureSet(DEVICE_ID_KEY, id);
    _deviceId = id;
    return id;
  } catch {
    const fallback = 'anon-' + Date.now().toString(36);
    _deviceId = fallback;
    return fallback;
  }
}

/** Get default player name from device ID */
export async function getDefaultPlayerName(): Promise<string> {
  const id = await getDeviceId();
  return 'Player' + id.slice(-4).toUpperCase();
}

export interface LeaderboardEntry {
  id: string;
  player_name: string;
  device_id: string;
  total_chips: number;
  hands_played: number;
  hands_won: number;
  biggest_win: number;
  updated_at: string;
}

/** Submit or update score on the leaderboard. Silent fail — never crashes the game. */
export async function submitScore(
  playerName: string,
  totalChips: number,
  handsPlayed: number,
  handsWon: number,
  biggestWin: number,
): Promise<boolean> {
  try {
    const supabase = getSupabase();
    if (!supabase) return false;

    const deviceId = await getDeviceId();

    // VAMOS-PRE506-INSERT 2026-06-22 — route through the server-authoritative submit_score
    // RPC (SECURITY DEFINER) instead of a direct table upsert. The RPC clamps the value
    // server-side so a client cannot forge an inflated total, and lets us later lock the
    // leaderboard INSERT policy to service_role (sequenced: only after this OTA adopts).
    const { error } = await supabase.rpc('submit_score', {
      p_device_id: deviceId,
      p_player_name: playerName || ('Player' + deviceId.slice(-4).toUpperCase()),
      p_total_chips: totalChips,
      p_hands_played: handsPlayed,
      p_hands_won: handsWon,
      p_biggest_win: biggestWin,
    });

    return !error;
  } catch {
    return false;
  }
}

/** Get top 20 leaderboard entries. Returns empty array on failure. */
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const supabase = getSupabase();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      // VAMOS-CAPS-LEADERBOARD-HIDE-BOTS: exclude seed bot rows (device_id 'bot_%').
      // In-game opponents come from local constants/gameLogic, never this table, so
      // hiding these rows is display-only and does not affect gameplay.
      .not('device_id', 'like', 'bot_%')
      .order('total_chips', { ascending: false })
      .limit(20);

    if (error || !data) return [];
    return data as LeaderboardEntry[];
  } catch {
    return [];
  }
}

/** Check if Supabase leaderboard is available */
export function isLeaderboardAvailable(): boolean {
  return isSupabaseConfigured;
}
