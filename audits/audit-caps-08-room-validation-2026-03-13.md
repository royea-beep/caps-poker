# Audit — VAMOS CAPS 08: Room Validation + Connect Safety
**Date:** 2026-03-13

## Scope
Harden internet multiplayer entry path: room existence validation, connect safety, failure messaging, cleanup.

## Changes Made

### utils/realtimeMultiplayer.ts

**New connection constants:**
- `SUBSCRIBE_TIMEOUT_MS = 10000` — max wait for Supabase channel subscribe
- `HOST_PRESENCE_WAIT_MS = 3000` — max wait for host to appear in presence
- `HOST_PRESENCE_POLL_MS = 300` — presence poll interval during host wait

**RealtimeServer.start() hardened:**
- Subscribe now wrapped in a Promise that resolves on SUBSCRIBED, rejects on CHANNEL_ERROR/TIMED_OUT, times out after 10s
- On failure: unsubscribes channel, clears clients, returns false
- Logs subscribe timeout and error status

**RealtimeClient.connect() hardened:**
- Same subscribe-with-timeout pattern as server
- After subscribe: polls presence state for a host entry (isHost: true) for up to 3s
- `waitForHostPresence()` — polls every 300ms, checks `hasHostInPresence()` which reads channel.presenceState()
- On no host found: calls `cleanupChannel()`, returns false with log
- `cleanupChannel()` helper — unsubscribes + nulls channel + sets connected=false
- Only sets `this.connected = true` after both subscribe AND host presence succeed

### app/lobby/internet-join.tsx

**Callback race fix:**
- `client.updateCallbacks({onCardsDealt: ...})` moved BEFORE `client.connect()` — eliminates the window where CARDS_DEALT could arrive before the callback is registered

**Room code validation:**
- Regex `/^[A-Z2-9]{4,6}$/` — matches the charset used by `generateOnlineRoomCode` (no I/O/0/1)
- Rejects codes with invalid characters before even attempting connection

**Failure cleanup:**
- On connect failure: `client.disconnect()`, `clientRef.current = null`
- Better alert message: "Room Not Found — Check the code and make sure the host is online"

**Dependency array fix:**
- Added missing `setConnectedPlayers` and `router` to useCallback deps

### app/lobby/internet-host.tsx

**Async safety:**
- Added `cancelled` flag to guard against setState after unmount
- Presence handler checks `cancelled` before updating state
- Start promise checks `cancelled` before updating state

**Failure cleanup:**
- On start failure: `server.stop()`, `serverRef.current = null`
- `.catch()` handler for unhandled rejections

**Context-aware error message:**
- If Supabase is configured but subscribe failed: "Could not create room. Check your internet connection."
- If Supabase not configured: original message with .env hint

## Failure Cases Now Handled

| Scenario | Before | After |
|----------|--------|-------|
| Supabase subscribe hangs | UI stuck on "Creating..." / "Connecting..." forever | Times out after 10s, shows error |
| Supabase subscribe returns CHANNEL_ERROR | Silently fails, returns true | Returns false, channel cleaned up |
| Guest joins nonexistent room code | Shows "connected" to empty room | Returns false after 3s host-not-found |
| Guest enters invalid characters in code | Accepted, fails silently later | Rejected immediately with alert |
| Host disconnects before guest connects | Guest shows "connected" with no host | connect() returns false |
| Network offline during room create | server.start() may throw | Caught, error screen shown |
| Component unmounts during async connect | Potential setState on unmounted | Cancelled guard prevents |
| CARDS_DEALT arrives before callback set | Silently lost | Impossible — callback set before connect |

## Risk Assessment
- **WiFi path:** Zero impact
- **Game screens:** Zero changes
- **Existing flow:** Preserved — successful connections work exactly as before
- **New behavior:** Only surfaces when connection actually fails (was previously silent)
