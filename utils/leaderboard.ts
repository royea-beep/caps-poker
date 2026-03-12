import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase, isSupabaseConfigured } from './supabase';

const DEVICE_ID_KEY = 'caps-device-id';

let _deviceId: string | null = null;

/** Get or create a stable device ID */
export async function getDeviceId(): Promise<string> {
  if (_deviceId) return _deviceId;
  try {
    const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (stored) {
      _deviceId = stored;
      return stored;
    }
    // Generate a UUID-like ID
    const id = 'xxxx-xxxx-xxxx'.replace(/x/g, () =>
      Math.floor(Math.random() * 16).toString(16)
    );
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
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

    const { error } = await supabase
      .from('leaderboard')
      .upsert(
        {
          device_id: deviceId,
          player_name: playerName || ('Player' + deviceId.slice(-4).toUpperCase()),
          total_chips: totalChips,
          hands_played: handsPlayed,
          hands_won: handsWon,
          biggest_win: biggestWin,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'device_id' }
      );

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
