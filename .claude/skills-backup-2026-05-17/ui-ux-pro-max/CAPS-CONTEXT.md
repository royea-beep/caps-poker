# CAPS Poker — Design Context

## Project Type
Mobile card game (iOS portrait, React Native + Expo SDK 55)

## Design System
- Background: #1a1a2e (dark navy)
- Primary Gold: #c9a84c
- Win color: #4CAF50 (normal) / #2196F3 (colorblind)
- Lose color: #ef5350 (normal) / #EF9F27 (colorblind)
- Text primary: #ffffff
- Text muted: rgba(255,255,255,0.5)

## Typography — Responsive
- All sizes via rf() responsive function
- Heading: rf(28) gold
- Body: rf(13) white
- Label: rf(11) muted

## Responsive Utils
- rs() = responsive spacing
- rv() = responsive vertical
- rf() = responsive font
- rh() = responsive horizontal

## Card Design
- Community cards: gold border rs(2.5) + glow
- Player cards: 3D float -5px/2000ms
- Bot cards: diamond lattice back
- Selected: gold border 2.5px + pulse

## Animations
- Animated.loop(sequence) — NEVER withRepeat(-1)
- Max 5 useSharedValue per screen
- useNativeDriver: true where possible

## Current Score
- Home: 9.0/10
- Game: 9.2/10
- Reveal: 9.5/10 (GGPoker-level)
- Results: 9.0/10
