/**
 * THE COMPLETE-BONUS PERCENTAGE, PULLED — NOT PUSHED.
 *
 * `getCompleteBonusPercent` in constants/gameConfig.ts reads module state that only the app's
 * bootstrap sets (`setCompleteBonusPctByBoards`, called from _layout.tsx:489). That fetch is
 * fire-and-forget inside a `useEffect(…, [])` with a SILENT catch, so any failure — offline, an RLS
 * change, a missing row — leaves the flat fallback of 50 in place for the whole session with
 * nothing on screen to say so.
 *
 * AND A FLAT 50 IS ONLY RIGHT AT ONE TABLE SIZE. The live map is {"2":25,"3":50,"4":75}, keyed by
 * BOARD count, and the board count is a function of player count (2P=4 boards, 3P=3, 4P=2):
 *
 *     2P · 4 boards   true 75%   fallback 50%   UNDERSTATES the sweep
 *     3P · 3 boards   true 50%   fallback 50%   correct by coincidence
 *     4P · 2 boards   true 25%   fallback 50%   OVERSTATES the sweep
 *
 * That number is shown to the player BEFORE they arrange, so being wrong there shapes a decision.
 *
 * This module follows utils/iapEnabled.ts and utils/privateChannel.ts: it FETCHES ITS OWN VALUE and
 * defaults safely. A value that must be pushed in can silently never arrive; a value that is pulled
 * cannot. The server-side equivalent of this bug nearly shipped a 50% bonus where 25% was owed,
 * which is why chipMath.ts takes the percentage as a parameter rather than reading it.
 */
import { getSupabase } from './supabase';
import { DEFAULT_CONFIG } from '../constants/gameConfig';

const KEY = 'complete_bonus_pct_by_boards';

let cached: Record<string, number> | null = null;
let inflight: Promise<Record<string, number> | null> | null = null;

async function load(): Promise<Record<string, number> | null> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const sb = getSupabase();
      if (!sb) return null;
      const { data, error } = await sb.from('app_config').select('value').eq('key', KEY).maybeSingle();
      if (error) return null;
      const v = data?.value;
      return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, number>) : null;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })().then((v) => {
    if (v) cached = v;
    return v;
  });
  return inflight;
}

/** Kick the fetch without waiting — safe to call from a render path. */
export function primeCompleteBonusPct(): void {
  void load();
}

/**
 * The percentage for this board count, or the config constant if nothing has been fetched yet.
 * Synchronous by design: callers are render paths, and a wrong-but-safe first frame that corrects
 * itself is better than blocking the arrangement screen on a network round trip.
 */
export function completeBonusPctFor(boardCount: number): number {
  // SELF-PRIMING. If nothing is cached yet this kicks the fetch and returns the safe default for
  // this frame; the next render picks up the real value. No caller has to remember to prime it,
  // which is the failure mode this module exists to remove.
  if (!cached) void load();
  const v = cached?.[String(boardCount)];
  return typeof v === 'number' && v >= 0 ? v : DEFAULT_CONFIG.completeBonusPercent;
}

/** Test seam only. */
export function _resetCompleteBonusPctCache(): void {
  cached = null;
}
