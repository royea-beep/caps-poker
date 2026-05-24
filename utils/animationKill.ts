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

// PR-C 2026-05-24: b153 visual restore. Defaults below let the new layers run
// (false = NOT killed). Flip to true to disable any single layer if it misbehaves.
// All driving animations are FINITE (withRepeat(N) for some N), never -1.
export const KILL_HeroParticles = false;
export const KILL_HeroFan       = true;  // static layout per spec — no breathe
export const KILL_HeroGlow      = false;
