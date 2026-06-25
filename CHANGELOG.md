# CAPS POKER — CHANGELOG

## Web — v2.7.0 — 2026-06-25
**Git (origin/main):** `e046314` · **Web bundle:** `index-f945e4e3` · **Deploy:** Vercel (caps.ftable.co.il)
**Native parity:** ⚠️ NOT in TestFlight Build 506 (built from `aea77e1`). Everything below landed
AFTER 506 and is **web-only** until an OTA (JS-only, runtimeVersion 2.7.0 matches 506) or a new build ships.

### GAME-MODES-OVERHAUL (3-phase) — Play surface rebuilt around a real multiplayer lobby
- **Phase 1** (`4a06f8f`): unified the game screen — Sit&Go now redirects to `/game`.
- **Phase 2 lobby** (`3d98fce`): MP lobby on `game_rooms` — `list_open_tables`/`create_table`/`join_table`
  SECURITY DEFINER RPCs (atomic seat-claim, autostart when full, invite-by-code) + lobby UI.
- **3A/3B** (`99a2a0c`): `room_players` roster wiring + `leave_table` + presence-on-exit + cleanup cron.
- **3D** (`0184448`): fixed the placement-timer soft-lock (broadcast OUTSIDE the setState updater).
- **3C/3E** (`58ea013`, `362d1a9`): wired lobby tables to a REAL synced host-authoritative MP game
  (`app/lobby/table.tsx` over the realtime engine) + `mp_game_started`/`mp_game_ended` telemetry;
  fixed a guest-hang (mpClient must be in the store before connect). 2-client runtime-verified end-to-end.
- **Phase 3** (`df38d64`): Play = **Single Player + Multiplayer Lobby** only (retired Quick Poker /
  Tournament / local-WiFi / Sit&Go entry points + routes). Fixed the `game_rooms` **'playing' leak** —
  new `finish_table` RPC (host marks room finished + clears roster at game end) + hardened
  `cleanup_expired_rooms` (self-heals stale 'playing', purges terminal rooms). Live-verified:
  room goes waiting→playing→finished with roster cleared.

### Pre-overhaul fixes (also post-506, web-only)
- **Telemetry re-activated** (`127a566`): `track()` was a no-op since 2026-06-17 (track_event RPC 404'd);
  restored + breadcrumbs + web error capture. Web-QA fixes (`272144b`): chip-shop tappable, audio
  autoplay-rejection swallowed.
- **Economy spend contract** fix (branch, applied as live DB change): `spend_chips` returns
  `{ok,chips_spent}` — Quick Poker entry / shop purchase were silently failing.
- **Cups progression** fix (live): `check_cups` now handles win_streak (platinum winnable) + grants XP;
  backfilled bronze tier.
- **Leaderboard** : hide seed `bot_%` rows (client filter shipped; live `DELETE` is owner DB cleanup).

---

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
