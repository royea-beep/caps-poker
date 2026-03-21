# CAPS POKER — Project Manifest
**For AI agents — read this before generating any plan**

## Feature Map
| Feature | Files | Notes |
|---------|-------|-------|
| Card display | components/Card.tsx | White bg, suit glow, suit border |
| Board layout | components/Board.tsx | Color-coded borders (gold/blue/green/orange) |
| Player hand | components/PlayerHand.tsx | 1.3x larger than board cards |
| Game logic | app/game.tsx, utils/gameLogic.ts | Tap-to-place, timer, phases |
| Reveal sequence | hooks/useRevealSequence.ts | Board-by-board turn+river |
| COMPLETE bonus | components/CompleteOverlay.tsx | Flash + 40 particles + gold pulse + haptics |
| Pro Quotes | components/ProQuoteBanner.tsx, constants/proQuotes.ts | TEXT ONLY — NO AUDIO. AI simulation quotes from poker pros. Disclaimer on every display. |
| Tutorial | components/Tutorial.tsx | 4-step overlay, first launch only |
| In-game hints | app/game.tsx (HINT_TEXTS) | First 3 games only, AsyncStorage counter |
| Sound system | utils/sounds.ts | Card place, win, lose, complete sounds |
| Settings | app/settings.tsx | Themes, pro quotes toggle, tutorial reset |
| Single player | app/game.tsx | vs random bot |
| Local MP | utils/gameServer.ts, gameClient.ts | react-native-tcp-socket |
| Internet MP | utils/realtimeMultiplayer.ts | Supabase Realtime |
| Leaderboard | Supabase table | Global scores |
| Hand history | app/hand-history.tsx | Past hands viewer |
| Economy | utils/economy.ts, constants/economyConfig.ts | Chips, match costs |
| Auth | utils/auth.ts | Google OAuth |

## What Does NOT Exist
- Pro Quotes have NO audio/sound files — they are text-only by design
- No drag-and-drop — tap only (Iron Rule)
- No backend server — all local + Supabase
- No chat between players (not yet)
- No tournament mode (not yet)

## Iron Rules (NEVER violate)
1. React Native + Expo only
2. iOS portrait only
3. All params runtime-configurable
4. Full Omaha evaluation (2 player + 3 board)
5. Bot = random only
6. No backend — AsyncStorage
7. Local MP via react-native-tcp-socket
8. Internet MP via Supabase Realtime
