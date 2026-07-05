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
 * ENABLED 2026-07-05 — owner verified the cross-device countdown + cut-and-jump on a real device.
 * DB prerequisites confirmed by strategist: bot_practice seeds current_players=0 (no premature
 * autostart), join_table stamps started_at on the 2nd-player join (drives the jump), ghost-reaper
 * >90s (won't evict a practicer holding a seat). See docs/PENDING_practice_to_live.md.
 */
export const PRACTICE_LIVE_ENABLED = true;
