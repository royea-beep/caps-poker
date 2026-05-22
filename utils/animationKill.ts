/**
 * ANIMATION KILL SWITCH
 * Set KILL_[FILE] = false to re-enable one file at a time during bisect.
 * All true = all repeating animations disabled (crash isolation).
 */

export const KILL_game          = true;
export const KILL_index         = true;
export const KILL_results       = true;
export const KILL_Board         = true;
export const KILL_CompleteOverlay = true;
export const KILL_ProQuoteBanner  = true;
// Card float loop removed 2026-05-22 — cards no longer bob up/down infinitely.
// Future Card animations must use finite iterations (per battle-pass.tsx iron rule).
export const KILL_Card          = true;
