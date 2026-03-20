// SecretSauce Learning Hooks for CAPS Poker
// Fire-and-forget event tracking — never throws, never blocks

import { Platform } from 'react-native';

const PROJECT = 'caps';
const VERSION = '1.3.0';

interface LearningEvent {
  project: string;
  version: string;
  event: string;
  category: 'feature_used' | 'error' | 'performance' | 'user_flow';
  value?: number;
  metadata?: Record<string, unknown>;
  sessionId: string;
  ts: number;
}

let queue: LearningEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function getSessionId(): string {
  if (typeof globalThis === 'undefined') return 'unknown';
  // Use a module-level variable since sessionStorage isn't available in RN
  if (!(globalThis as any).__caps_session_id) {
    (globalThis as any).__caps_session_id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  return (globalThis as any).__caps_session_id;
}

function enqueue(event: Omit<LearningEvent, 'ts' | 'sessionId'>): void {
  try {
    queue.push({ ...event, ts: Date.now(), sessionId: getSessionId() });
    if (queue.length >= 20) {
      flush();
    } else if (!flushTimer) {
      flushTimer = setTimeout(flush, 10000);
    }
  } catch { /* never throw */ }
}

function flush(): void {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (queue.length === 0) return;
  const batch = [...queue];
  queue = [];

  // Relative URL only works on web — skip on native to avoid silent network errors
  if (Platform.OS !== 'web') return;
  // SPA deployment (Vercel static) has no /api/learn endpoint — suppress silently
  return;
  fetch('/api/learn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events: batch }),
  }).catch(() => { /* silent */ });
}

// Flush on web page unload
// SPA deployment has no /api/learn endpoint — beacon suppressed
// if (Platform.OS === 'web' && typeof window !== 'undefined') {
//   window.addEventListener('visibilitychange', () => {
//     if (document.visibilityState === 'hidden' && queue.length > 0) {
//       const blob = new Blob([JSON.stringify({ events: queue })], { type: 'application/json' });
//       navigator.sendBeacon('/api/learn', blob);
//       queue = [];
//     }
//   });
// }

export const CapsHooks = {
  gameStarted: (mode: 'solo' | 'multiplayer' | 'online') =>
    enqueue({ project: PROJECT, version: VERSION, event: 'game_started', category: 'feature_used', metadata: { mode } }),

  cardPlaced: (board: number, position: number, timeMs: number) =>
    enqueue({ project: PROJECT, version: VERSION, event: 'card_placed', category: 'feature_used', value: timeMs, metadata: { board, position } }),

  boardCompleted: (board: number, handRank: string, won: boolean) =>
    enqueue({ project: PROJECT, version: VERSION, event: 'board_completed', category: 'feature_used', metadata: { board, handRank, won } }),

  gameCompleted: (score: number, won: boolean, totalMs: number) =>
    enqueue({ project: PROJECT, version: VERSION, event: 'game_completed', category: 'performance', value: totalMs, metadata: { score, won } }),

  bonusAchieved: (type: string, amount: number) =>
    enqueue({ project: PROJECT, version: VERSION, event: 'bonus_achieved', category: 'feature_used', metadata: { type, amount } }),

  multiplayerJoined: (roomCode: string, mode: 'tcp' | 'realtime') =>
    enqueue({ project: PROJECT, version: VERSION, event: 'multiplayer_joined', category: 'feature_used', metadata: { roomCode, mode } }),

  multiplayerDisconnected: (reason: string) =>
    enqueue({ project: PROJECT, version: VERSION, event: 'multiplayer_disconnected', category: 'error', metadata: { reason } }),

  settingsChanged: (setting: string, value: unknown) =>
    enqueue({ project: PROJECT, version: VERSION, event: 'settings_changed', category: 'feature_used', metadata: { setting, value } }),

  dailyRewardClaimed: (streak: number, amount: number) =>
    enqueue({ project: PROJECT, version: VERSION, event: 'daily_reward_claimed', category: 'feature_used', value: amount, metadata: { streak } }),

  screenViewed: (screen: string) =>
    enqueue({ project: PROJECT, version: VERSION, event: 'screen_viewed', category: 'user_flow', metadata: { screen } }),
};
