/**
 * handOutbox — make the solo/practice hand write survive a fast navigate.
 *
 * THE PROBLEM, measured 2026-08-21. app/results.tsx recorded the hand with a fire-and-forget
 * `void (async () => { ... await sb.rpc('record_hand_result_d', ...) })()`. Nothing awaits it and
 * nothing retries it, so when the player leaves /results before the request settles the browser
 * cancels it and the hand is never recorded. One of two hands was lost that way in a measured run.
 * Both hand history AND achievements inherit it, because check_achievements counts hand_history
 * rows — a tester who plays three hands and sees two stops trusting everything else on screen.
 *
 * THE FIX. Persist the INTENT before going near the network, then try to send it:
 *
 *   1. queueHandResult() writes the hand into AsyncStorage FIRST. This is the whole point — if the
 *      app is closed or navigated a millisecond later, the record already survives locally.
 *   2. It then attempts the RPC immediately. On success the entry is removed.
 *   3. flushHandOutbox() runs at app start and re-sends anything still pending.
 *
 * WHAT HAPPENS IF THE PLAYER NAVIGATES DURING THE WRITE — the case that loses rows today: the
 * in-flight request is cancelled and the RPC never lands, exactly as before. The difference is that
 * the entry is still in storage, so the next app start re-sends it and the hand appears. The hand is
 * delayed, never lost.
 *
 * WHY A RETRY IS SAFE. Every entry carries a stable client_hand_id and record_hand_result_d is now
 * idempotent on (device_id, client_hand_id), backed by the partial unique index
 * uq_hand_history_client_ref — the same shape as uq_hand_net_ref. A resend of a hand that already
 * landed returns {duplicate:true} and inserts nothing, so a retry can never inflate hands_played or
 * double-fire the achievements trigger. Without that key this file would trade a lost hand for a
 * miscounted one.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase } from './supabase';

const KEY = 'caps_hand_outbox';
/** A queue this long means the device has been offline for a long time; oldest are dropped first. */
const MAX_PENDING = 50;

export type PendingHand = {
  id: string;
  deviceId: string;
  won: boolean;
  boardsWon: number;
  boardsTotal: number;
  sessionType: string;
  queuedAt: number;
};

/** Stable per-hand id. Not security-sensitive — it only has to be unique per device. */
function newHandId(): string {
  const g: any = globalThis as any;
  if (g?.crypto?.randomUUID) return g.crypto.randomUUID();
  return `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function read(): Promise<PendingHand[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function write(list: PendingHand[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_PENDING)));
  } catch {
    // Storage full or unavailable: nothing useful to do, and throwing here would take down the
    // results screen for a bookkeeping failure.
  }
}

/** Send one entry. Returns true only when the server confirms it (including an idempotent repeat). */
async function send(h: PendingHand): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const { data, error } = await sb.rpc('record_hand_result_d', {
      p_device_id: h.deviceId,
      p_won: h.won,
      p_boards_won: h.boardsWon,
      p_boards_total: h.boardsTotal,
      p_session_type: h.sessionType,
      p_client_hand_id: h.id,
    });
    if (error) return false;
    return !!(data as any)?.ok;
  } catch {
    return false;
  }
}

async function remove(id: string): Promise<void> {
  const list = await read();
  await write(list.filter((h) => h.id !== id));
}

/**
 * Record a completed solo/practice hand. Persists first, then attempts to send.
 * Never throws — the caller is a render effect on the results screen.
 */
export async function queueHandResult(
  entry: Omit<PendingHand, 'id' | 'queuedAt'> & { id?: string },
): Promise<void> {
  const hand: PendingHand = { ...entry, id: entry.id ?? newHandId(), queuedAt: Date.now() };
  const list = await read();
  await write([...list, hand]);          // survives a navigate from this line onward
  if (await send(hand)) await remove(hand.id);
}

/**
 * Re-send everything still pending. Safe to call repeatedly; idempotent server-side.
 * Returns how many entries were confirmed, which is what the tests assert on.
 */
export async function flushHandOutbox(): Promise<number> {
  const list = await read();
  if (!list.length) return 0;
  let sent = 0;
  for (const h of list) {
    if (await send(h)) { await remove(h.id); sent++; }
  }
  return sent;
}

/** Test/diagnostic helper — how many hands are still waiting to reach the server. */
export async function pendingHandCount(): Promise<number> {
  return (await read()).length;
}
