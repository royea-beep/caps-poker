# Checkpoint — VAMOS CAPS ECONOMY 01: Economy Infrastructure Design
**Date:** 2026-03-13

## Summary
Design-only audit for CAPS economy. Single-currency (chips) model with 5 feature flags (all off at launch), generous free-play defaults, 5 new store fields, 2 new files planned. 6-step implementation roadmap defined. No code written.

## Files Changed
None — design/audit only.

## Key Decisions
- Single currency (chips), no dual currency
- All economy features behind boolean flags, defaulting to false
- Match cost = existing potPerBoard × boardCount
- Daily reward: 200 base + 50/day streak (cap 7)
- Free refill: 500 chips, unlimited cooldown for now
- New files: constants/economyConfig.ts, utils/economy.ts
- Store extension: 5 new persisted fields

## Next Step
ECONOMY 02: Create economyConfig.ts + extend gameStore with economy fields. Zero-risk scaffolding.

## Status
Design complete. Ready for ECONOMY 02 implementation.
