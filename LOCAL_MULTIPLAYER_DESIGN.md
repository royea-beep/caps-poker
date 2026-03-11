# Caps Poker -- Local Multiplayer Design

## Architecture Overview

```
+--------------------------------------------------+
|                  HOST DEVICE                      |
|                                                   |
|  +------------+    +---------------------------+  |
|  | Game Store |<-->| WebSocket Server (TCP)    |  |
|  | (Zustand)  |    | Port 9876                 |  |
|  +-----+------+    +--+-----+-----+-----------+  |
|        |               |     |     |              |
|        v               |     |     |              |
|  +------------+        |     |     |              |
|  |  Host UI   |        |     |     |              |
|  +------------+        |     |     |              |
+-----------------------|-----|-----|---------------+
                        |     |     |
              LAN / Wi-Fi (same subnet)
                        |     |     |
         +--------------+     |     +--------------+
         |                    |                    |
+--------v-------+  +--------v-------+  +---------v------+
| GUEST DEVICE 1 |  | GUEST DEVICE 2 |  | GUEST DEVICE 3 |
|                 |  |                |  |                 |
| +-------------+ |  | +------------+|  | +-------------+ |
| | WS Client   | |  | | WS Client  ||  | | WS Client   | |
| +------+------+ |  | +-----+------+|  | +------+------+ |
|        |         |  |       |       |  |        |        |
| +------v------+ |  | +-----v------+|  | +------v------+ |
| | Guest Store | |  | | Guest Store||  | | Guest Store | |
| | (Zustand)   | |  | | (Zustand)  ||  | | (Zustand)   | |
| +------+------+ |  | +-----+------+|  | +------+------+ |
|        |         |  |       |       |  |        |        |
| +------v------+ |  | +-----v------+|  | +------v------+ |
| |  Guest UI   | |  | |  Guest UI  ||  | |  Guest UI   | |
| +-------------+ |  | +------------+|  | +-------------+ |
+-----------------+  +---------------+  +----------------+
```

### Connection Flow

```
HOST                                     GUEST
 |                                         |
 |  1. Create room                         |
 |     - Generate 4-digit code             |
 |     - Start WS server on :9876          |
 |     - Display: code + local IP          |
 |                                         |
 |          2. Enter room code             |
 |  <--------------------------------------+
 |          + host IP (manual entry)       |
 |                                         |
 |  3. WS handshake                        |
 |  <=====================================>|
 |                                         |
 |  4. room:joined (assign seat)           |
 |  +------------------------------------->|
 |                                         |
 |  5. Host starts game                    |
 |  +-- game:deal (player's cards only) -->|
 |                                         |
 |  6. Players arrange cards               |
 |  <------ player:ready -----------------+|
 |                                         |
 |  7. All ready -> reveal                 |
 |  +-- game:reveal (board results) ------>|
 |                                         |
 |  8. After all boards revealed           |
 |  +-- game:summary -------------------->|
```

---

## Room Discovery Strategy

### Approach: Manual IP + Room Code (no mDNS)

mDNS / Bonjour discovery (`react-native-zeroconf`, `react-native-bonjour`) is
attractive but has significant drawbacks for this use case:

- Requires native modules (not Expo Go compatible without dev client)
- Inconsistent across Android versions (mDNS is flaky on Android < 12)
- Adds complexity for a 2-4 player same-room game

**Chosen approach:** The host displays its local IP address and a 4-digit room
code on screen. The guest manually enters the host IP (or scans a QR code that
encodes `ws://<ip>:9876?room=XXXX`). The room code acts as a lightweight auth
token to prevent random connections.

Future enhancement: if needed, add `expo-network` to auto-detect the local IP
and `react-native-zeroconf` in a custom dev client for zero-config discovery.

---

## Message Protocol

All messages are JSON with a `type` field and a `payload` field.
Direction is indicated as H->G (host to guest), G->H (guest to host), or
H<->G (bidirectional).

### Connection & Lobby

#### `join` (G->H)
Guest requests to join the room.
```json
{
  "type": "join",
  "payload": {
    "roomCode": "4829",
    "playerName": "Alice",
    "deviceId": "uuid-v4"
  }
}
```

#### `room:state` (H->G)
Sent to all guests whenever lobby state changes (player joins/leaves, game config changes).
```json
{
  "type": "room:state",
  "payload": {
    "roomCode": "4829",
    "hostName": "Bob",
    "players": [
      { "id": "host-uuid", "name": "Bob", "seat": 0, "connected": true },
      { "id": "guest-uuid", "name": "Alice", "seat": 1, "connected": true }
    ],
    "playerCount": 2,
    "maxPlayers": 4,
    "config": { "timeLimit": 60 }
  }
}
```

#### `room:error` (H->G)
```json
{
  "type": "room:error",
  "payload": {
    "code": "ROOM_FULL",
    "message": "Room is full (4/4 players)"
  }
}
```
Error codes: `ROOM_FULL`, `INVALID_CODE`, `GAME_IN_PROGRESS`, `KICKED`.

#### `room:kick` (H->G)
Host removes a player from the lobby.
```json
{
  "type": "room:kick",
  "payload": { "playerId": "guest-uuid", "reason": "Removed by host" }
}
```

### Game Messages

#### `game:deal` (H->G, per-player)
Each player receives ONLY their own cards. Board open cards are shared;
closed cards are withheld until reveal.
```json
{
  "type": "game:deal",
  "payload": {
    "yourCards": [
      { "id": "A_hearts", "suit": "hearts", "rank": "A" },
      { "id": "K_spades", "suit": "spades", "rank": "K" }
    ],
    "boards": [
      {
        "boardIndex": 0,
        "openCards": [
          { "id": "10_clubs", "suit": "clubs", "rank": "10" },
          { "id": "7_diamonds", "suit": "diamonds", "rank": "7" },
          { "id": "3_hearts", "suit": "hearts", "rank": "3" }
        ],
        "closedCardCount": 2
      }
    ],
    "cardsPerBoard": 4,
    "timeLimit": 60,
    "playerCount": 2,
    "boardCount": 4
  }
}
```

#### `game:timer` (H->G, broadcast)
Periodic timer sync (every 5 seconds or on significant thresholds).
```json
{
  "type": "game:timer",
  "payload": { "timeRemaining": 30 }
}
```

#### `player:arrange` (G->H)
Player submits their card arrangement. Cards are identified by `id`.
```json
{
  "type": "player:arrange",
  "payload": {
    "boards": [
      { "boardIndex": 0, "cardIds": ["A_hearts", "K_spades", "10_diamonds", "5_clubs"] },
      { "boardIndex": 1, "cardIds": ["Q_hearts", "J_spades", "9_diamonds", "4_clubs"] }
    ]
  }
}
```

#### `player:ready` (G->H)
Player signals they are done arranging.
```json
{
  "type": "player:ready",
  "payload": { "final": true }
}
```

#### `game:player_ready` (H->G, broadcast)
Notifies all players that someone locked in.
```json
{
  "type": "game:player_ready",
  "payload": {
    "playerId": "guest-uuid",
    "playerName": "Alice",
    "readyCount": 1,
    "totalPlayers": 2
  }
}
```

#### `game:reveal` (H->G, broadcast)
Sent one board at a time for dramatic reveal pacing.
```json
{
  "type": "game:reveal",
  "payload": {
    "boardIndex": 0,
    "closedCards": [
      { "id": "J_hearts", "suit": "hearts", "rank": "J" },
      { "id": "2_clubs", "suit": "clubs", "rank": "2" }
    ],
    "playerHands": [
      {
        "playerId": "host-uuid",
        "playerName": "Bob",
        "cards": ["A_hearts", "K_spades", "10_diamonds", "5_clubs"],
        "handRank": "Two Pair",
        "handDescription": "Aces and Kings"
      },
      {
        "playerId": "guest-uuid",
        "playerName": "Alice",
        "cards": ["Q_hearts", "J_spades", "9_diamonds", "4_clubs"],
        "handRank": "Pair",
        "handDescription": "Pair of Jacks"
      }
    ],
    "winnerId": "host-uuid",
    "winnerName": "Bob"
  }
}
```

#### `game:summary` (H->G, broadcast)
Final results after all boards revealed.
```json
{
  "type": "game:summary",
  "payload": {
    "boardResults": [
      { "boardIndex": 0, "winnerId": "host-uuid" },
      { "boardIndex": 1, "winnerId": "guest-uuid" },
      { "boardIndex": 2, "winnerId": "host-uuid" },
      { "boardIndex": 3, "winnerId": "host-uuid" }
    ],
    "scores": [
      { "playerId": "host-uuid", "name": "Bob", "boardsWon": 3, "chipsWon": 150 },
      { "playerId": "guest-uuid", "name": "Alice", "boardsWon": 1, "chipsWon": 50 }
    ],
    "isComplete": true,
    "completeBonusWinner": "host-uuid",
    "completeBonusAmount": 40
  }
}
```

#### `game:new_round` (H->G, broadcast)
Host starts a new round.
```json
{
  "type": "game:new_round",
  "payload": { "roundNumber": 2 }
}
```

### Heartbeat

#### `ping` / `pong` (H<->G)
Sent every 3 seconds. If no pong received within 9 seconds, connection is
considered lost.
```json
{ "type": "ping", "payload": { "ts": 1710100000000 } }
{ "type": "pong", "payload": { "ts": 1710100000000 } }
```

---

## State Sync Strategy

### Principle: Host is the Single Source of Truth

The host device runs all game logic. Guests are "dumb terminals" that:
1. Render state received from the host
2. Send user actions (card placements, ready signals) to the host
3. Never run `dealCards`, `evaluateBoard`, or `calculateHandResults`

### What Each Device Stores Locally

| Data | Host | Guest |
|------|------|-------|
| Full deck | Yes | No |
| All players' dealt cards | Yes | No (own cards only) |
| Board closed cards | Yes | No (until reveal) |
| Own card arrangement | Yes | Yes |
| Other players' arrangements | Yes | No (until reveal) |
| Timer authoritative value | Yes | No (display only) |
| Game phase | Yes | Mirror of host |
| Player list & connection state | Yes | Mirror of host |

### State Flow

```
Guest action (e.g., place card on board)
    |
    v
Guest sends `player:arrange` to host
    |
    v
Host validates the action
    |
    +--> Valid:   Host updates authoritative state
    |             Host broadcasts updated state to all
    |
    +--> Invalid: Host sends `room:error` to that guest
```

### Optimistic Updates

For card arrangement (the most latency-sensitive action), guests apply changes
locally immediately and send the update to the host. If the host rejects it
(e.g., invalid card ID, card already used), the host sends a correction and
the guest rolls back.

### Timer Synchronization

The host is the timer authority. It broadcasts `game:timer` every 5 seconds.
Guests run a local countdown for smooth display but reset to the host's value
on each sync. When the timer hits zero, only the host triggers the transition
to the reveal phase.

---

## Error Handling

### Player Disconnects Mid-Game

```
Disconnect detected (no pong for 9s)
    |
    v
Host marks player as disconnected
    |
    v
Host broadcasts updated room:state (player.connected = false)
    |
    v
30-second reconnection window
    |
    +--> Player reconnects within window:
    |      - Guest sends `join` with same deviceId
    |      - Host recognizes deviceId, restores seat
    |      - Host sends full current game state
    |      - Game continues normally
    |
    +--> Player does NOT reconnect:
         |
         +--> During arrangement phase:
         |      Auto-fill disconnected player's boards (random placement)
         |      Mark player as "bot" for remainder of round
         |      Continue game
         |
         +--> During reveal/summary phase:
                Continue without them (results already determined)
```

### Host Disconnects

If the host device goes down, the game is lost. There is no host migration in
v1. Guests detect the disconnect and display a "Host disconnected" screen with
an option to return to the main menu.

Future enhancement: host migration where the next player in seat order becomes
the new host and all guests reconnect to them.

### Other Error Scenarios

| Scenario | Handling |
|----------|----------|
| Guest sends invalid card IDs | Host ignores, sends `room:error` with details |
| Guest sends cards after timer expires | Host ignores (already auto-filled) |
| Two guests claim same seat | First-come-first-served; second gets next open seat |
| Network congestion / slow messages | Heartbeat detects issues; 9s grace period |
| Room code collision | Extremely unlikely with 4-digit codes for local play; regenerate if detected |
| Guest app backgrounded (iOS/Android) | WebSocket may close; handled same as disconnect with reconnect window |

---

## Required npm Packages

### Core Networking

| Package | Purpose | Expo Compatible? |
|---------|---------|-----------------|
| `react-native-tcp-socket` | TCP server on host device for WebSocket | Requires dev client (not Expo Go) |
| `ws` (or custom minimal WS impl) | WebSocket protocol over TCP socket | Used with tcp-socket |
| `expo-network` | Get device local IP address to display to host | Yes (Expo Go) |

### Recommended Alternative: `react-native-websocket-server`

There is no mature standalone WS server package for React Native. The practical
options are:

1. **`react-native-tcp-socket`** + hand-rolled WebSocket upgrade -- the most
   proven path. The TCP socket package has solid community support and the WS
   handshake/framing protocol is simple enough to implement in ~200 lines.

2. **Relay through a local Express/HTTP server** using
   `@aspect-build/react-native-http-server` or similar -- heavier but gives a
   full HTTP + WS stack on the device.

3. **Expo custom dev client only approach** using Node.js-compatible `ws`
   package with `react-native-polyfill-globals` -- requires careful polyfilling
   of Node.js APIs.

**Recommended for v1:** Option 1 (`react-native-tcp-socket` + minimal WS
framing layer).

### Supporting Packages

| Package | Purpose |
|---------|---------|
| `expo-network` | Detect local IP for host display |
| `expo-barcode-scanner` or `expo-camera` | QR code scanning for easy room join |
| `expo-haptics` | Already installed; haptic feedback on game events |
| `uuid` | Generate unique device/player IDs |
| `zustand` | Already installed; extend for multiplayer state |

### Development / Testing

| Package | Purpose |
|---------|---------|
| `ws` (Node.js) | Mock WebSocket server for unit/integration tests |
| `jest` | Already installed |

---

## Reusable Code from Sibling Projects

### From `C:\Projects\shared-utils`

| Module | Path | Use in Caps |
|--------|------|-------------|
| **CircuitBreaker** | `src/resilience/index.ts` | Wrap reconnection attempts -- after N failures, stop retrying and show "connection lost" UI instead of hammering the host |
| **retryWithBackoff** | `src/resilience/index.ts` | Exponential backoff for WebSocket reconnection attempts during the 30-second reconnect window |

The `validate-url` and `errors` modules are server-oriented and not directly
useful for local multiplayer.

### From `C:\Projects\Wingman`

| Module | Path | Use in Caps |
|--------|------|-------------|
| **ChatSocketEvents** (pattern) | `packages/shared/src/types/chat.ts` | The typed event map pattern (`{ 'event:name': PayloadType }`) is a good model for our message protocol types. Adapt this to define `CapsSocketEvents` with full TypeScript inference. |

### From `C:\Projects\royea-mobile-launch-kit`

No directly reusable networking code found. The launch kit focuses on social
auth and preflight checks.

---

## File Organization (Proposed)

```
utils/
  multiplayer/
    protocol.ts        -- Message type definitions & CapsSocketEvents type map
    hostServer.ts      -- WebSocket server (TCP socket + WS framing)
    guestClient.ts     -- WebSocket client wrapper with reconnect logic
    roomManager.ts     -- Room code generation, player seat management
    stateSynchronizer.ts -- Host-side state broadcast logic

store/
  multiplayerStore.ts  -- Zustand store slice for multiplayer state

hooks/
  useMultiplayer.ts    -- React hook combining store + server/client lifecycle

app/
  multiplayer/
    host.tsx           -- Host lobby screen (shows code, IP, player list)
    join.tsx           -- Guest join screen (enter code + IP)
    game.tsx           -- Multiplayer game screen (reuses existing board UI)
```

---

## Security Considerations

- **Room code as token:** The 4-digit code is sufficient for local play (same
  room, same Wi-Fi). It prevents accidental connections, not malicious ones.
- **No sensitive data:** Card data is not valuable enough to warrant encryption
  on a local network. If desired later, TLS can be added to the TCP socket.
- **Rate limiting:** Host should limit join attempts to prevent brute-forcing
  the 4-digit code (max 5 attempts per IP per minute).
- **Input validation:** Host validates ALL incoming messages. Never trust card
  IDs or board indices from guests without checking them against the
  authoritative game state.

---

## Migration Path from Bot Play

The existing `gameLogic.ts` functions (`initializeGame`, `evaluateBoard`,
`calculateHandResults`) all run on the host and are directly reusable. The key
changes:

1. Replace `dealCards()` with `dealCardsMultiplayer(playerCount)` (already exists in `deck.ts`)
2. Replace bot-specific logic (`placeBotCards`) with receiving `player:arrange` messages
3. Replace the `'bot'` winner ID with actual player IDs
4. The existing `BoardState` type needs its `botCards` field generalized to `opponentCards: Card[][]` (already partially done in `MultiBoardState` in `gameTypes.ts`)

The single-player vs. multiplayer game screen can share 90%+ of the board
rendering and card drag-and-drop UI. The difference is the data source: local
Zustand state (single player) vs. WebSocket-synced Zustand state (multiplayer).
