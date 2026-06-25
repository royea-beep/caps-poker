# CAPS POKER — PREPLAN

> North star: **App Store launch** of a polished **single-player** experience + a **working
> multiplayer lobby**. iOS first (TestFlight → App Store), Android + web alongside.

_Last updated: 2026-06-25 · main `e046314` · web bundle `index-f945e4e3` · native TestFlight Build 506 (`aea77e1`)_

## Where we are
- **Web** is ahead of native: the full Play overhaul + telemetry are live on caps.ftable.co.il.
- **Native (Build 506)** predates all post-`aea77e1` work — no telemetry, no unified game, no MP lobby,
  no 2-option Play. Closing that gap is the central near-term task (Phase C).
- App was **never submitted** to the App Store — TestFlight only. No gambling-theme age rating set.

## Phases

### A — Stabilize (foundation) — _mostly done (web)_
Telemetry flowing again, economy spend contract correct, cups progression fixed, leaderboard bots
hidden, crash/error reporting live. Remaining: verify each holds on **native** (Phase C dependency),
confirm RLS/INSERT-lock hardening on the lobby tables.

### B — Play-overhaul — ✅ DONE + LIVE (web)
Single Player + Multiplayer Lobby only. Lobby tables play a real synced host-authoritative game;
`finish_table` kills the room leak. Runtime-verified 2- and 3-client end-to-end. See
`docs/sessions/VAMOS-CAPS-GAME-MODES-OVERHAUL-COMPLETE-2026-06-25.md`.

### C — Native parity — _NEXT (owner-gated)_
Get the post-506 JS (telemetry + lobby + Play overhaul) onto native and verify it on-device.
- **OTA is viable:** all post-506 changes are **JS-only** (no native dep changes since `aea77e1`),
  `version` is unchanged at **2.7.0**, and `runtimeVersion.policy = appVersion` → an `eas update`
  on the **`production`** channel/branch would apply to the 506 binary. (expo-updates is enabled,
  `checkAutomatically: ON_LOAD`.)
- **OR** a fresh build (507) if the owner prefers a clean binary.
- Either way: **device-verify the MP lobby on native** (Supabase Realtime presence/broadcast on a
  real device + network) — so far only web-verified.

### D — App Store launch
Age rating (gambling theme → 17+/18), store listing + screenshots, privacy/terms (exist), final QA
pass, submit. Currently submission has never run.

### E — Post-launch
INSERT-lock / RLS hardening, MP hardening (reconnection, 3P/4P real-world, spectator), monitoring on
the new telemetry, dead-code sweep, single-player depth/polish.

## Constraints / working rules
- iOS builds via GitHub Actions (not EAS build). OTA via EAS Update. Owner runs builds/OTAs/submits.
- Web deploys from `main` (Vercel auto-deploy). `scripts/fix-web-html.js` patches `type="module"`.
- DB changes: prod DB = deploy; capture live RPCs as `supabase/migrations/*` for reproducibility.
- VAMOS = always a `.md`. Never suggest App Store submission unless the owner says so.

See **TASKLIST.md** for the P0/P1/P2 breakdown with status.
