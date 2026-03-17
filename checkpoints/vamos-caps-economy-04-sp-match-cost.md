# Checkpoint — VAMOS CAPS ECONOMY 04: Single-Player Match Cost Wiring
**Date:** 2026-03-13

## Summary
Wired single-player match cost through economy utilities behind matchCostEnabled flag. Added trackChipsSpent/trackChipsEarned store actions. Home screen gates affordability when flag is on. Buy-in uses getMatchCost(). Results uses canAffordMatch(). Flag is off — zero behavior change.

## Files Changed
| File | Action |
|------|--------|
| `store/gameStore.ts` | Added trackChipsSpent + trackChipsEarned actions |
| `app/game.tsx` | Economy imports, getMatchCost for buy-in, conditional stat tracking |
| `app/index.tsx` | Economy imports, handleNewHand with affordability gate |
| `app/results.tsx` | Economy imports, getMatchCost + canAffordMatch for next-hand check |

## Status
Single-player match cost plumbing complete. Flag off = identical behavior. Ready for ECONOMY 05 (multiplayer match cost) or ECONOMY 06 (UI).
