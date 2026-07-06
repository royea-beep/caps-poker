/**
 * Feature flags — gate not-yet-fully-verified features so their code can ship dormant.
 * Flip to true only after the feature's verification requirements are met.
 */

/**
 * PRACTICE-TO-LIVE realtime jump. When TRUE: the 2P (Heads-Up) bot row holds a REAL realtime
 * seat while you practice, so a human can drop in and both jump into a live game. When false:
 * pure LOCAL practice (no join_table, no seat-hold, no live=1, no countdown/jump). The Home
 * "Practice vs Bots" button fix and the practice session demo counter are INDEPENDENT of this
 * flag either way.
 *
 * KILL-SWITCHED 2026-07-06 (MP-STABILITY, urgent) — owner ran a real 2-device game: the reveal
 * never fired for the guest AND pressing back while waiting evicted the seat.
 *
 * FLAG AUDIT (2026-07-06): there is ALSO a Supabase app_config row `practice_mode_enabled=true`.
 * Confirmed by full-repo grep (client, all supabase/functions, all supabase/migrations) plus a
 * live pg_proc source search (`prosrc ILIKE '%practice_mode_enabled%'`) that it is an ORPHAN —
 * no RPC, edge function, or client code reads it anywhere. This client-side constant is the
 * ONLY real gate for the realtime seat-hold + countdown + jump path (read in app/lobby/index.tsx's
 * playBot and utils/practiceLiveSession.ts). Flipping it to false does NOT touch plain local bot
 * practice (no join_table, no seat-hold) — that keeps working exactly as before; only the "hold
 * a real seat while you practice, then jump" behavior is disabled.
 *
 * Re-enable ONLY after a real 2-device pass (owner + tester) confirms both bugs are fixed.
 * See docs/PENDING_practice_to_live.md.
 */
export const PRACTICE_LIVE_ENABLED = false;
