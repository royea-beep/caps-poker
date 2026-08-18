/**
 * useCapsSystem — typed Supabase RPC wrappers for all CAPS backend calls
 * Generated: 2026-04-14
 */
import { getSupabase } from '../utils/supabase';

// ─── Return types ─────────────────────────────────────────────────────────────

export interface CupItem {
  id: string;
  name_he: string;
  tier: string;
  color: string;
  earned: boolean;
  progress: number;
  /** The unlock condition, already sent by get_cup_collection and previously never rendered:
   *  `desc` reads "Win 10 hands", `req` is the threshold. The Cups screen showed five locked rows
   *  with no statement of what unlocks them — a locked door with no keyhole — while the server had
   *  been supplying the answer all along. */
  desc?: string;
  req?: number;
}

export interface HomeScreenV2 {
  cups: { cups: CupItem[]; total: number; earned: number };
  daily_status: { streak: number; reward: number; can_claim: boolean };
  leaderboard_rank: number | null;
  active_mission: { id: string; title: string; progress: number; total: number; reward: number } | null;
}

export interface HomeScreenV3 {
  stage: 'new' | 'beginner' | 'active' | 'veteran';
  chips: number;
  welcome_he: string;
  tagline_he?: string;
  online_count_he?: string;
  play_button_he: string;
  daily_reward: { show: boolean; label_he: string };
  streak: number;
  streak_he: string;
  show_streak: boolean;
  show_friend_challenge: boolean;
  friend_challenge_he: string;
  friend_sub_he: string;
  show_cups: boolean;
  cups: { cups: CupItem[]; total: number; earned: number };
  cups_label_he: string;
  show_sng: boolean;
  sng_label_he: string;
  quick_label_he: string;
  show_mode_selector: boolean;
  show_stats: boolean;
  stats: { hands_played: number; win_rate: number } | null;
  stats_label_he: string;
}

export interface FriendChallenge {
  code: string;
  expires_at: string;
  mode: string;
  buyin: number;
}

export interface AcceptChallengeResult {
  success: boolean;
  game_id?: string;
  message?: string;
}

export interface Achievement {
  id: string;
  title: string;
  title_he: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlocked_at?: string;
}

export interface Mission {
  id: string;
  title: string;
  title_he: string;
  progress: number;
  target: number;
  reward_chips: number;
  completed: boolean;
  claimed: boolean;
}

export interface PlayerStatsV2 {
  hands_played: number;
  hands_won: number;
  win_rate: number;
  best_streak: number;
  current_streak: number;
  chips: number;
  level: number;
  elo: number;
}

export interface HandRecord {
  hand_id: string;
  played_at: string;
  boards_won: number;
  boards_total: number;
  net_chips: number;
  is_complete: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  player_id: string;
  player_name: string;
  score: number;
  is_me: boolean;
}

export interface SngTier {
  tier: number;
  label: string;
  label_he: string;
  buyin: number;
  prize: number;
  cups_earned: number;
}

export interface DailyStatus {
  can_claim: boolean;
  streak: number;
  reward: number;
  next_reward: number;
}

export interface WeeklyRecap {
  hands_played: number;
  hands_won: number;
  chips_earned: number;
  cups_this_week: string[];
  achievements_this_week: string[];
  top_hand?: string;
}

export interface AppOpenResult {
  daily_streak_claimed: boolean;
  streak: number;
  reward: number;
  cups_awarded: string[];
}

// ─── RPC wrappers ─────────────────────────────────────────────────────────────

async function rpc<T>(name: string, params: Record<string, unknown>): Promise<T | null> {
  try {
    const sb = getSupabase();
    if (!sb) return null;
    const { data, error } = await sb.rpc(name, params);
    if (error) { console.warn(`[useCapsSystem] ${name} error:`, error.message); return null; }
    return data as T;
  } catch (e) {
    console.warn(`[useCapsSystem] ${name} threw:`, e);
    return null;
  }
}

export const CapsSystem = {
  /** Combined home screen data — cups, daily status, rank, mission */
  getHomeScreenV2: (userId: string) =>
    rpc<HomeScreenV2>('get_home_screen_v2', { p_user_id: userId }),

  /** Cup collection for device */
  getCupCollection: (deviceId: string) =>
    rpc<{ cups: CupItem[]; total: number; earned: number }>('get_cup_collection', { p_device_id: deviceId }),

  /** Check and award any newly-earned cups */
  checkCups: (deviceId: string) =>
    rpc<{ awarded: string[] }>('check_cups', { p_device_id: deviceId }),

  /** Create a friend challenge — returns code + expiry */
  createFriendChallenge: (userId: string, mode = 'quick_poker', buyin = 200) =>
    rpc<FriendChallenge>('create_friend_challenge', { p_user_id: userId, p_mode: mode, p_buyin: buyin }),

  /** Accept a friend challenge by code */
  acceptFriendChallenge: (userId: string, code: string) =>
    rpc<AcceptChallengeResult>('accept_friend_challenge', { p_user_id: userId, p_code: code }),

  /** Full achievements list with unlock status */
  getAchievementsList: (userId: string) =>
    rpc<Achievement[]>('get_achievements_list', { p_user_id: userId }),

  /** Daily missions for device */
  getDailyMissions: (deviceId: string) =>
    rpc<Mission[]>('get_daily_missions_d', { p_device_id: deviceId }),

  /** Claim a completed mission */
  claimMission: (deviceId: string, missionId: string) =>
    rpc<{ success: boolean; chips_earned: number }>('claim_mission_d', { p_device_id: deviceId, p_mission_id: missionId }),

  /** Player stats v2 */
  getPlayerStats: (playerId: string) =>
    rpc<PlayerStatsV2>('get_player_stats_v2', { p_player_id: playerId }),

  /** Paginated hand history */
  getHandHistory: (userId: string, limit = 20, offset = 0) =>
    rpc<HandRecord[]>('get_hand_history', { p_user_id: userId, p_limit: limit, p_offset: offset }),

  /** Full replay data for a hand */
  getHandReplay: (handId: string) =>
    rpc<Record<string, unknown>>('get_hand_replay', { p_hand_id: handId }),

  /** Generate shareable hand card */
  shareHandCard: (handId: string, userId: string) =>
    rpc<{ url: string }>('share_hand_card', { p_hand_id: handId, p_user_id: userId }),

  /** Chips leaderboard */
  getLeaderboard: (limit = 20) =>
    rpc<LeaderboardEntry[]>('get_leaderboard', { p_limit: limit }),

  /** ELO leaderboard */
  getEloLeaderboard: (limit = 20) =>
    rpc<LeaderboardEntry[]>('get_elo_leaderboard', { p_limit: limit }),

  /** Sit&Go tiers with cup progress */
  getSngTiers: (userId: string) =>
    rpc<SngTier[]>('get_sng_tiers', { p_user_id: userId }),

  /** Claim daily login reward */
  claimDailyReward: (deviceId: string) =>
    rpc<{ success: boolean; chips: number; streak: number }>('claim_daily_reward', { p_device_id: deviceId }),

  /** Daily streak + reward status */
  getDailyStatus: (deviceId: string) =>
    rpc<DailyStatus>('get_daily_status', { p_device_id: deviceId }),

  /** Current bot difficulty for device */
  getBotDifficulty: (deviceId: string) =>
    rpc<string>('get_bot_difficulty', { p_device_id: deviceId }),

  /** Weekly recap with cups + achievements */
  generateWeeklyRecap: (userId: string) =>
    rpc<WeeklyRecap>('generate_weekly_recap', { p_user_id: userId }),

  /** On-app-open hook — streaks, cups, welcome back */
  onAppOpen: (userId: string) =>
    rpc<AppOpenResult>('on_app_open', { p_user_id: userId }),

  /** Create referral link */
  createReferralLink: (deviceId: string) =>
    rpc<{ code: string; url: string }>('create_referral_link', { p_device_id: deviceId }),

  /** Redeem referral code */
  redeemReferral: (deviceId: string, code: string) =>
    rpc<{ success: boolean; message: string }>('redeem_referral', { p_device_id: deviceId, p_code: code }),

  /** Home screen v3 — progressive disclosure based on stage */
  getHomeScreenV3: (userId: string) =>
    rpc<HomeScreenV3>('get_home_screen_v3', { p_user_id: userId }),
} as const;
