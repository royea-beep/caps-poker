# CAPS POKER — CHANGELOG

## Build 237 — v1.9.4 — 2026-03-25
**Git:** 7a906b6
**OTAs in this build:**
- `23ee0a17` — fix(S62): player cards visible on boards + hints at 2+ cards + cleaner board UI — 2026-03-25
- `1e2beaba` — feat(S62): avatar picker + player profile (12 emojis, persisted) — 2026-03-25
- `dbb8266b` — feat(S61): hand history 50 hands + replay screen — 2026-03-25
- `b22e64f1` — fix(S59B): useEffect cleanups + remove testers.tsx + revealStart sound — 2026-03-25

### What changed (S59–S62):
- S59: Issues hunt + useEffect cleanups + dead code removed (testers.tsx)
- S60: Chat + emotes, time bank, pot size visibility, sound reveal arc
- S61: Hand history (50 hands max) + replay screen (board-by-board, ZERO Reanimated)
- S62: Avatar picker (12 emojis) + player profile + share card
- S62-FIX: Player cards visible on boards during arrangement + hand hints at 2+ cards + cleaner BOT label

---

## Build 236 — v1.9.4 — 2026-03-25
**Git:** 23dec38
**OTAs in this build:**
- `86b72220` — S54B: OTA nuclear check + verbose debug info — 2026-03-24

### What changed (S54B–S58):
- S54B: OTA nuclear check (immediate + every 30s) + verbose OTA debug in settings
- S55: OTA nuclear fix (hermesc NODE_OPTIONS — Windows hermesc fix)
- S56: Full audit — all 13 features verified green
- S57: Debug pipeline audit — all 7 components working
- S58: WhatsApp pipeline verified, chipTimer fix

---

## Build 235 — v1.9.4 — 2026-03-25
**Git:** e6929f4

---

## Build 234 — v1.9.4 — 2026-03-25
**Git:** 944b264

### What changed (S60):
- Chat + emotes between players
- Time bank mechanic
- Pot size visibility improvements
- Sound reveal arc

---

## Build 233 — v1.9.4 — 2026-03-25
**Git:** 479c80c

---

## Build 232 — v1.9.4 — 2026-03-24
**Git:** 1b89e79

### What changed:
- chore: remove dead dependencies (expo-auth-session, react-native-confetti-cannon, jimp)

---

## Build 231 — v1.9.4 — 2026-03-24
**Git:** 1c6f147

### What changed:
- chore: add npm run ota script with NODE_OPTIONS fix for Windows hermesc

---

## Build 230 — v1.9.4 — 2026-03-24
**Git:** 27731c9

### What changed:
- fix(S54B): OTA nuclear check (immediate + every 30s) + verbose OTA debug in settings
- fix: duplicate card guard + bot faceDown during arrangement + BoardReveal layout order

---

## Build 229 — v1.9.4 — 2026-03-24
**Git:** c71e36f

### What changed:
- fix(S54B): force OTA check on launch + Defender exclusion documented

---

## Build 228 — v1.9.4 — 2026-03-24
**Git:** 5be55c6

---

## Full Feature History (S49–S62)

| Sprint | Feature |
|--------|---------|
| S49 | Card flip animation in single-player reveal |
| S50 | Visual restore — results animations, CompleteOverlay particles |
| S51 | Full audit |
| S52 | Tap-to-skip, strong hand haptic, board subtitle, OTA indicator |
| S53 | BoardReveal full-screen per board + hand hint |
| S54 | Defender fix + duplicate card guard + bot hidden + layout fix |
| S55 | OTA nuclear fix (hermesc NODE_OPTIONS) |
| S56 | Full audit — all features verified |
| S57 | Debug pipeline audit |
| S58 | WhatsApp pipeline verified, chipTimer fix |
| S59 | Issues hunt + useEffect cleanups + dead code removed |
| S60 | Chat + emotes, time bank, pot size visibility, sound arc |
| S61 | Hand history (50 hands) + replay screen |
| S62 | Avatar picker + player profile + share card |
| S62-FIX | Player cards visible on boards + hand hints + cleaner UI |
