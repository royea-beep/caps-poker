# Checkpoint — VAMOS CAPS 03: Internet Multiplayer Crash Audit
**Date:** 2026-03-13

## Finding
Internet multiplayer is 100% non-functional. RealtimeServer/RealtimeClient are thin Supabase channel wrappers with no game logic. multiplayer-game.tsx and results.tsx call 15+ methods that don't exist on the Realtime classes. Every interaction crashes with TypeError on game screen mount.

## Root Cause
Two-system architecture (WiFi=GameServer, Internet=RealtimeServer) where the internet side was never completed beyond transport.

## Crash Count
- 11 missing methods on RealtimeServer (crash points)
- 4 missing methods on RealtimeClient (crash points)
- 2 lobby-level data shape mismatches

## Repair Plan
5-step surgical fix: add game logic to RealtimeServer (Step 1), add methods to RealtimeClient (Step 2), fix lobby host flow (Step 3), fix lobby join flow (Step 4), add message routing (Step 5). Follow-up: type the store interfaces (Step 6).

## Architecture Verdict
Architecture is salvageable. No rewrite needed. Target API is already defined by GameServer/GameClient.

## No Code Changes Made
This was an audit-only step.
