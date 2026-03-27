# CAPS Poker — Project Map for Claude Code CI

## Stack
React Native + Expo SDK 55 | TypeScript strict | Supabase backend | Jest 29

## Key directories
- `app/` — Expo Router screens: `game.tsx`, `index.tsx`, `results.tsx`, `settings.tsx`, `replay.tsx`, `hand-history.tsx`, `sit-and-go.tsx`, `tournament.tsx`, `coaching.tsx`
- `components/` — Reusable: `Card.tsx`, `PlayerHand.tsx`, `Board.tsx`, `BugReporter.tsx`, `BoardReveal.tsx`, `BoardResultCard.tsx`, `EfficiencyCard.tsx`
- `utils/` — `supabase.ts`, `logBuffer.ts`, `testAudioPipeline.ts`, `responsive.ts`, `i18n.ts`, `sounds.ts`
- `store/` — Zustand: `gameStore.ts`
- `constants/` — `gameConfig.ts`, `visualThemes.ts`, `deviceBreakpoints.ts`
- `supabase/functions/` — Edge Functions (Deno)

## Card system
- `components/Card.tsx` — Single card. Props: `card`, `faceDown`, `small`, `highlighted`, `dimmed`, `cardWidth`, `cardHeight`, `hideCornerLabels`
- `components/PlayerHand.tsx` — Player's hole cards at bottom ("YOUR HAND" area). Uses `hideCornerLabels` on every card.
- `components/Board.tsx` — One game board (community cards + player card slots)
- `components/BoardReveal.tsx` — Full-screen reveal animation after all cards placed

## Game screens
- `app/game.tsx` — Main game: boards + PlayerHand + timer + bot logic
- `app/results.tsx` — Results: "X beats Y" — ZERO Reanimated allowed here (use RN Animated only)
- `app/index.tsx` — Lobby + PLAY button

## Styling rules
- All sizes: `rv(mobile, mobileWeb, tablet, desktop, native)` OR `rs(n)` (responsive scale)
- Base screen width: 390pt
- Colors: bg `#1C0508`, boardBg `#6B1520`, gold `#c9a84c`, neonBlue `#00BFFF`, neonGreen `#39FF14`
- Dark theme everywhere
- NO `Dimensions.get()` at module level (crashes web)
- NO expo-file-system legacy functions (`readAsStringAsync`, `copyAsync`) — use `fetch+arrayBuffer` or `File.bytes()`

## Testing
- Run: `npx tsc --noEmit` then `npx jest --forceExit`
- 2,444 tests — all must pass before committing
- OTA deploy: `npm run ota -- --message "description"`

## NEVER
- Use ConfettiCannon or CompleteOverlay (Hermes kill — too many animated views)
- Use withRepeat(-1) in Reanimated (infinite loops crash Hermes)
- Use Alert.alert on web (unreliable)
- Call expo-file-system legacy functions
- Hardcode secrets or credentials
