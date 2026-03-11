# Multiplayer Test Guide — Caps Poker

## Prerequisites

- 2 iPhones (or 1 iPhone + 1 iPad) on the **same WiFi network**
- Dev build installed on both devices (`eas build --profile development`)
- Both devices must be registered in your Apple Developer provisioning profile

## Step-by-Step: Host

1. Open the app on Device A (host)
2. Tap **LOCAL MULTIPLAYER** on home screen
3. Tap **HOST GAME**
4. Wait for server to start — you'll see:
   - **Room Code**: 4-digit number (e.g., `4827`)
   - **Your IP**: the host's local IP address (e.g., `192.168.1.100`)
   - **Connected Players** list (you appear as Player 1)
5. Select max players (2/3/4) using the selector buttons
6. Share the **Room Code** and **IP address** with other players
7. Wait for all players to connect (they appear in the list)
8. Once all players show as connected, tap **START GAME**

## Step-by-Step: Client (Join)

1. Open the app on Device B (client)
2. Tap **LOCAL MULTIPLAYER** on home screen
3. Tap **JOIN GAME**
4. Enter the **Host IP address** (from host screen)
5. Enter the **Room Code** (4-digit code from host screen)
6. Tap **CONNECT**
7. Wait for connection (up to 30 seconds timeout)
8. On success: green "CONNECTED" badge appears, you see the player list
9. Wait for host to start the game

## Expected Behavior

### During Connection
- Connection establishes within 1-3 seconds on local WiFi
- Client sends ROOM_JOIN → server validates room code → sends ROOM_JOIN_ACK
- If room code is wrong: "Invalid room code" error
- If room is full: "Room is full" error

### During Game
- Host deals cards automatically — all players receive their hands simultaneously
- Each player arranges cards on their boards (timer runs independently per player)
- When a player taps READY, their card assignments are sent to the host
- Host evaluates all boards when all players are ready (or timer expires)
- Results are broadcast to all players
- Chip deltas are calculated and displayed

### Reconnection
- If a player backgrounds the app or loses WiFi briefly:
  - Client attempts 3 reconnection attempts with 2-second intervals
  - Server recognizes returning player by `deviceId` and restores their seat
  - Heartbeat resets after returning from background
- If reconnection fails after 3 attempts: player is marked disconnected
  - Disconnected player's cards are auto-assigned randomly by host

## Network Details

| Parameter | Value |
|---|---|
| Port | 8765 |
| Protocol | TCP, newline-delimited JSON |
| Heartbeat interval | 5 seconds |
| Heartbeat timeout | 15 seconds |
| Connection timeout | 30 seconds |
| Reconnect attempts | 3 (with 2s backoff) |
| Max message size | 64 KB |
| Max player name | 20 characters |

## Troubleshooting

### "Connection timed out"
- Verify both devices are on the same WiFi network
- Check that the IP address is correct (not localhost/127.0.0.1)
- Ensure no firewall is blocking port 8765
- Try toggling WiFi off/on on both devices

### "Invalid room code"
- Room code is case-sensitive numeric (4 digits)
- Re-check the code on the host screen
- Host may have restarted — get the new code

### "Room is full"
- Host selected fewer max players than connected
- One player needs to leave, or host needs to increase max players

### Server won't start
- Check console for TCP socket errors
- App needs the custom dev build (not Expo Go) for `react-native-tcp-socket`
- Kill and restart the app if server was already running

### Game doesn't start
- All connected players must show in the list
- Host must tap START GAME — it's not automatic
- Check that player count matches connected count

## Console Debugging

On the host device, watch for these log patterns:
- `[GameServer] listening on <IP>:<PORT>` — server started
- `[GameServer] client connected` — TCP connection received
- `[GameServer] ROOM_JOIN from <name>` — join request received
- `[GameServer] heartbeat timeout for <id>` — player went silent
- `[GameServer] client reconnected (deviceId: ...)` — successful reconnect

On the client device:
- `[GameClient] connecting to <IP>:<PORT>` — connection attempt
- `[GameClient] ROOM_JOIN_ACK` — successfully joined
- `[GameClient] heartbeat sent` — keepalive working
- `[GameClient] reconnecting (attempt N/3)` — reconnect in progress
