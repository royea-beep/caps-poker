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

/**
 * ONE-WIN-COUNTER 2026-08-23 — a hand has THREE outcomes, not two.
 *
 * This was `won: boolean`, so every tie was queued as a loss and stored as one. The outcome is
 * now carried end to end: 'tie' becomes p_won NULL, which record_hand_result_d stores as 'tied'
 * and the leaderboard trigger counts as neither a win nor a loss.
 */
export type HandOutcome = 'win' | 'loss' | 'tie';

export type PendingHand = {
  id: string;
  deviceId: string;
  outcome: HandOutcome;
  boardsWon: number;
  boardsTotal: number;
  sessionType: string;
  queuedAt: number;
};

/** What the server said, when the first send got through. */
export type QueueResult = { sent: boolean; eloDelta: number | null };

/**
 * An entry queued by an OLDER build carries `won: boolean` and no `outcome`. It is still sitting
 * in this device's storage and must not be dropped or mis-sent, so it is migrated on read.
 * A legacy tie is indistinguishable from a legacy loss — that information was never stored — so
 * it stays a loss rather than being guessed at.
 */
function migrate(h: any): PendingHand {
  if (h && typeof h.outcome === 'string') return h as PendingHand;
  return { ...h, outcome: h?.won ? 'win' : 'loss' } as PendingHand;
}

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
    return Array.isArray(parsed) ? parsed.map(migrate) : [];
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

/**
 * Send one entry. Returns the server's reply when it confirms (including an idempotent repeat),
 * or null when it did not get through.
 *
 * THIS IS NOW THE ONLY CALL THAT RECORDS A HAND. It used to be one of two: this wrote the row and
 * a separate update_leaderboard_elo moved the counters, and because they were separate network
 * calls one could land without the other. The counters are now written by an AFTER INSERT trigger
 * on hand_history, inside this call's transaction, so a retry cannot double them and a failure
 * cannot skip them. `elo_delta` comes back from the same reply.
 */
async function send(h: PendingHand): Promise<any | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb.rpc('record_hand_result_d', {
      p_device_id: h.deviceId,
      // NULL means TIE. Not `h.outcome === 'win'`, which would send a tie as false = a loss.
      p_won: h.outcome === 'tie' ? null : h.outcome === 'win',
      p_boards_won: h.boardsWon,
      p_boards_total: h.boardsTotal,
      p_session_type: h.sessionType,
      p_client_hand_id: h.id,
    });
    if (error) return null;
    return (data as any)?.ok ? data : null;
  } catch {
    return null;
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
): Promise<QueueResult> {
  const hand: PendingHand = { ...entry, id: entry.id ?? newHandId(), queuedAt: Date.now() };
  const list = await read();
  await write([...list, hand]);          // survives a navigate from this line onward
  const data = await send(hand);
  if (!data) return { sent: false, eloDelta: null };
  await remove(hand.id);
  // null rather than 0 when the server did not report one: 0 is a REAL delta (it is what a tie
  // applies), so it must not double as "unknown".
  const d = (data as any)?.elo_delta;
  return { sent: true, eloDelta: typeof d === 'number' ? d : null };
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
    if (await send(h) !== null) { await remove(h.id); sent++; }
  }
  return sent;
}

/** Test/diagnostic helper — how many hands are still waiting to reach the server. */
export async function pendingHandCount(): Promise<number> {
  return (await read()).length;
}
