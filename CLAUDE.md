# CAPS Poker — Claude Code Brain

## Quick start
1. Run on Empire HQ (vjxqlqtlywovnbidovit):
   SELECT bot_landing_brief('caps-poker');
2. Read the response — it has EVERYTHING: state, blockers, rules, risks
3. Register your session:
   SELECT bot_register_session('caps-poker', 'cc-caps-main', 'claude_code', 'task description');
4. Heartbeat every 10-15 min:
   SELECT bot_heartbeat('SESSION_ID', 'current task');
5. End session:
   SELECT bot_end_session('SESSION_ID', 'handoff notes');

## Project IDs
- Supabase (CAPS): gxrpunvhjcrzqnitbqah
- Empire HQ: vjxqlqtlywovnbidovit
- GitHub: royea-beep/caps-poker
- Web: caps.ftable.co.il (Vercel)
- Local: C:\Projects\POKER\Caps

## Game rules (CRITICAL — memorize)
- Board count DYNAMIC: 2P=4, 3P=3, 4P=2
- Each player: 4 cards PER BOARD (not 4 total)
- Each board: 5 community cards
- Single 52-card deck, max 4 players
- Code: getBoardCount() + getCardsPerPlayer() in constants/gameConfig.ts
- NEVER hardcode board counts

## Current state (Apr 2026)
- Version: 2.7.0 | Build: B458 (building)
- Tests: 2,474/2,474
- 56 tables, 127 RPCs, 16 Edge Functions
- Visual: maroon felt #5C1818, warm cards #FFFEF8, red/black suits
- 5 tabs: בית/שחק/חברים/כוסות/פרופיל
- 100% Hebrew UI
- Auth: Anonymous + Google login prompt after game 3-5

## Key RPCs
- health_check() — run first every session
- get_current_build() — what build is live
- delete_user_account(device_id, user_id) — account deletion (22 tables)
- merge_guest_to_user(device_id, user_id) — guest to Google merge
- track_event(event, device_id, properties, screen) — analytics
- get_home_screen_v3(device_id or user_id) — home data

## Key files
- app/(tabs)/index.tsx — Home (2475 lines)
- app/game.tsx — Game (~1486 lines)
- app/results.tsx — Results (~1099 lines)
- app/settings.tsx — Settings + account deletion
- components/Card.tsx — Card rendering (CARD BIBLE)
- components/Board.tsx — Board display
- utils/auth.ts — Anonymous + Google auth
- utils/analytics.ts — Supabase track_event
- utils/supabase.ts — Client with AsyncStorage persistence
- constants/gameConfig.ts — getBoardCount(), game constants

## Hard rules
- DO NOT hardcode board counts — use getBoardCount()
- Colors look PINK on screen — go 2-3x darker than hex picker
- Alert.alert fails on web — skip on web, navigate directly
- expo-file-system legacy functions BROKEN in SDK 55
- All analytics via Supabase track_event RPC (NOT PostHog)
- Never suggest App Store submission unless Roye says so
- GitHub Actions builds (not EAS)
- VAMOS = always .md file, never chat-only instructions

## Before ANY release
1. Full test suite green
2. Visual check every screen on device
3. Progressive disclosure: screens not overloaded for new players
4. No half-done features visible
5. No encoding bugs (check for broken emoji/unicode)
