# Audit — VAMOS CAPS 10: Host-Alive Detection + Mid-Game Disconnect Handling
**Date:** 2026-03-13

## Scope
Detect and safely handle host/guest disconnects during lobby and active game states. Prevent silent dead-session states.

## Changes Made

### utils/realtimeMultiplayer.ts

**New constants:**
- `HOST_LOST_GRACE_MS = 5000` — grace period before firing host-lost (avoids false positives on transient presence flickers)
- `WAITING_STATE_TIMEOUT_MS = 60000` — max time to wait in any waiting state (exported for screens)

**New client callbacks:**
- `onHostLost?: () => void` — fires when host presence disappears for > 5s
- `onDisconnected?: () => void` — fires when channel encounters CHANNEL_ERROR or CLOSED

**Client: Host-alive monitoring:**
- `checkHostAlive()` — called on every presence sync
- If host is missing and no grace timer running: starts 5s grace timer
- If host returns during grace: cancels timer, logs restoration
- If grace expires and host still missing: fires `onHostLost`, sets `hostLostFired` flag to prevent double-fire
- `clearHostMonitoring()` — cleans up timers, called by `disconnect()`

**Server: Guest disconnect during active hand:**
- In `syncClientsFromPresence()` — when a guest disconnects during an active hand (`handId > 0`):
  - Auto-marks them as `isReady = true` with random card assignments (handled by existing `runRevealSequence` auto-fill)
  - Auto-adds them to `nextHandRequests` so next-hand flow isn't blocked
  - Re-checks `checkAllReady()` and `checkNextHandReady()` immediately
  - Logs all auto-ready actions

**Server: Channel error callback:**
- `onDisconnected?: () => void` on `RealtimeServerCallbacks`
- Listens for system events after subscribe; fires on CHANNEL_ERROR or CLOSED

**Client: Channel error monitoring:**
- Same system event listener; fires `onDisconnected` callback

### app/multiplayer-game.tsx

**Disconnect banner UI:**
- `disconnectBanner` state — shows red banner at top of game screen
- Styles: red-tinted background, bold text

**Guest: Host-lost detection:**
- Wires `onHostLost` callback — shows Alert "Host Disconnected" with Leave option
- Wires `onDisconnected` callback — shows Alert "Connection Lost" with Leave option
- Both: set disconnect banner, navigate to home on Leave

**Host: Channel disconnect detection:**
- Wires `onDisconnected` callback — same pattern as guest

**Waiting-state timeout (both host and guest):**
- 60s timeout starts when phase enters `'waiting'`
- On expire: Alert "Waiting Timed Out" with Keep Waiting / Leave options
- Cleared automatically when phase changes away from waiting

### app/results.tsx

**Waiting-for-next-hand timeout:**
- 60s timeout starts when user clicks NEXT HAND in multiplayer
- On expire: Alert "Waiting Timed Out" with Keep Waiting / Leave
- Cleared when next hand actually arrives

**Guest: Host-lost detection while waiting:**
- `onHostLost` callback — Alert "Host Disconnected", Leave to home
- `onDisconnected` callback — Alert "Connection Lost", Leave to home
- Disconnect message shown inline in waiting UI with Leave button

**Host: Timeout cleared on new hand dealt:**
- `onNewHandDealt` clears waiting timeout before navigating

### app/lobby/internet-join.tsx

**Host-lost detection in lobby:**
- `onHostLost` callback registered before `connect()` — "Host Left" alert, client cleanup, status → error
- `onDisconnected` callback — "Connection Lost" alert, same cleanup
- Guest can then tap "TRY AGAIN" to rejoin a different room

## Disconnect Handling Model

| Scenario | Detection | Grace | User Action |
|----------|-----------|-------|-------------|
| Host disappears in lobby | Presence sync → no host for 5s | 5s | Alert "Host Left", status → error, TRY AGAIN button |
| Host disappears in game | Presence sync → no host for 5s | 5s | Banner + Alert "Host Disconnected", Leave → home |
| Host disappears on results (waiting) | Presence sync → no host for 5s | 5s | Alert "Host Disconnected", Leave → home, inline button |
| Guest disappears in lobby | Presence sync, player count drops | 0s (instant) | Host sees player count update |
| Guest disappears in game | Presence sync → client marked disconnected | 0s | Auto-ready the guest (random cards), game continues |
| Guest disappears on results | Presence sync → next-hand-requests auto-added | 0s | Host proceeds to next hand without waiting |
| Channel error (either side) | System event listener | 0s | Alert "Connection Lost", Leave → home |
| Waiting state hangs | 60s timeout | 60s | Alert "Waiting Timed Out", Keep Waiting / Leave |

## False Positive Prevention
- Host-lost uses 5s grace period before firing — transient presence flickers won't trigger it
- Grace timer cancelled if host returns within 5s
- Re-check after grace expiry (final confirmation before firing)
- `hostLostFired` flag prevents double-fire
- Waiting timeout shows "Keep Waiting" option — not forced exit

## Risk Assessment
- **WiFi path:** Zero impact — all changes are in Realtime classes and multiplayer screens
- **Game screens:** Multiplayer-game.tsx and results.tsx get new effects + UI, but existing gameplay flow unchanged
- **Single-player:** Zero impact — all disconnect code gated by `isMultiplayer` / `mpClient` / `mpServer`
- **Existing connect/subscribe flow:** Preserved — disconnect detection only activates post-connection
