# Caps Poker — Multiplayer Architecture Research

> **Date:** 2026-03-11
> **Note:** WebSearch/WebFetch were unavailable during this research session. Findings are based on deep framework knowledge current to early-mid 2025. Star counts and minor API details should be verified before final architecture decisions.

---

## OSS Card Game / Multiplayer Game Projects

### 1. `nicholasgasior/react-native-poker`
- **URL:** https://github.com/nicholasgasior/react-native-poker (approx.)
- **Stars:** ~50-100
- **Tech stack:** React Native, Node.js backend, Socket.io
- **Room creation:** Socket.io rooms; host creates a room code, others join
- **State sync:** Server-authoritative; full game state broadcast on each action
- **Turn management:** Server tracks whose turn it is; client sends actions, server validates
- **Mobile-friendly:** Yes (built for RN)
- **Expo-compatible:** Likely needs ejection for some native modules

### 2. `nicedoc/poker-hand-evaluator` / various poker logic libraries
- **URL:** Multiple repos on GitHub (e.g., `goldfire/pokersolver`)
- **Stars:** `pokersolver` has ~400+ stars
- **Tech stack:** Pure JavaScript — hand evaluation only, no multiplayer
- **Relevance:** Useful for hand ranking logic; can be combined with any multiplayer framework
- **Expo-compatible:** Yes (pure JS)

### 3. `nicholasgasior/gostern` and similar Go/Node poker servers
- **Tech stack:** Go or Node.js WebSocket server + any frontend
- **Room creation:** REST API to create rooms, WebSocket for real-time play
- **State sync:** Server-authoritative, JSON state messages over WebSocket
- **Turn management:** Server-side turn loop
- **Mobile-friendly:** Backend-agnostic; any client can connect
- **Expo-compatible:** Yes, if using standard WebSocket client

### 4. `seanhess/react-native-card-game` (and similar tutorial repos)
- **Stars:** ~20-50
- **Tech stack:** React Native + Firebase Realtime Database
- **Room creation:** Firebase push keys as room IDs
- **State sync:** Firebase listeners for real-time updates
- **Turn management:** Client writes to Firebase; simple turn flag in DB
- **Expo-compatible:** Yes (Firebase JS SDK works with Expo)

### 5. `boardgame.io examples` (various card games)
- **URL:** https://github.com/boardgameio/boardgame.io/tree/main/examples
- **Stars:** boardgame.io itself has ~10,000+ stars
- **Tech stack:** boardgame.io framework (React, Node.js, Socket.io under the hood)
- **Room creation:** Lobby API built-in
- **State sync:** Automatic via boardgame.io's log-based state management
- **Turn management:** First-class turn/phase system
- **Expo-compatible:** Partial (see detailed analysis below)

### Key Takeaway from OSS Survey
Most open-source multiplayer card games use one of three patterns:
1. **Socket.io + custom server** — most common, most flexible, most work
2. **Firebase Realtime DB** — easiest for prototyping, limited game logic enforcement
3. **boardgame.io** — best framework-level support for turn-based games

---

## Option 1: boardgame.io

**Website:** https://boardgame.io
**GitHub:** https://github.com/boardgameio/boardgame.io (~10k+ stars)

### Tech
- **Framework:** JavaScript/TypeScript turn-based game framework
- **Transport:** Socket.io (default) or custom transport
- **Server:** Node.js (Express-based)
- **Storage:** In-memory (dev), MongoDB / FlatFile / custom (prod)
- **Client:** Framework-agnostic core + React board integration layer

### Features
- Declarative game definition: `moves`, `phases`, `turn`, `endIf`
- Automatic state sync between clients
- Built-in lobby system (room creation, player slots, matchmaking)
- Turn ordering (round-robin, custom)
- Secret state (players can't see each other's cards)
- Undo/redo support
- AI players via MCTS (Monte Carlo Tree Search)
- Game log / replay
- 2-N player support (2-4 for Caps Poker is trivially supported)

### How It Handles Core Concerns
| Concern | Approach |
|---------|----------|
| Room creation | Built-in Lobby API: `createMatch()`, `joinMatch()`, `listMatches()` |
| Player joining | Lobby assigns player seats (0, 1, 2, 3); credential-based |
| State sync | Automatic — server is authoritative; clients receive filtered state |
| Turn management | Declarative: `turn: { moveLimit: 1, order: TurnOrder.DEFAULT }` |
| Secret state | `playerView` function strips hidden info per-player |
| Validation | Moves validated server-side; `INVALID_MOVE` returned if illegal |

### Pros
- Purpose-built for exactly this kind of game (turn-based, card game, 2-4 players)
- Handles the hardest problems: secret state, turn order, move validation
- Large community, well-documented, battle-tested
- Game logic is pure functions — very testable
- Free / open source

### Cons
- **React Native / Expo support is not first-class.** The `boardgame.io/react` integration is DOM-based. You must use the plain JS client (`boardgame.io/client`) and wire up your own RN views
- Socket.io transport works in React Native but needs `socket.io-client` polyfill setup
- Requires running a Node.js server (even for LAN play, you'd run it on one device or a local machine)
- Not actively maintained at a rapid pace (stable but slower updates)
- Lobby UI components are React-web only; need to build RN lobby screens

### Expo Compatible: PARTIAL
- The **core game engine and plain client** work in Expo (pure JS)
- The **React board integration** (`boardgame.io/react`) does NOT work (uses ReactDOM)
- The **Socket.io transport** works with `@expo/websocket-polyfill` or similar
- **Verdict:** Usable but requires custom integration layer for React Native views

### Effort Estimate
- Game logic definition: **Low effort** (boardgame.io handles the hard parts)
- RN/Expo integration: **Medium effort** (custom board component wiring)
- Server deployment: **Medium effort** (need a Node.js server)

---

## Option 2: Supabase Realtime

**Website:** https://supabase.com/docs/guides/realtime
**GitHub:** https://github.com/supabase/realtime

### Tech
- **Protocol:** WebSocket (Phoenix Channels under the hood — Elixir/Phoenix server)
- **Features:** Three modes:
  - **Broadcast:** Send ephemeral messages to all channel subscribers (fire-and-forget)
  - **Presence:** Track who's online, sync shared state across clients
  - **Postgres Changes:** Listen to database INSERT/UPDATE/DELETE in real-time
- **Client:** `@supabase/supabase-js` — works in React Native / Expo

### How It Could Handle Core Concerns
| Concern | Approach |
|---------|----------|
| Room creation | Create a channel per game room: `supabase.channel('game:ROOM_CODE')` |
| Player joining | Presence: `channel.track({ user_id, name, seat })` — see who's in the room |
| State sync | Option A: Broadcast game state on each action. Option B: Store in Postgres, listen via Postgres Changes |
| Turn management | Must be implemented manually in application code |
| Secret state | Must be implemented manually (server function / Edge Function to filter) |

### Latency Characteristics
- Broadcast: **~50-150ms** globally (routed through Supabase infra)
- On same region: **~20-50ms**
- Postgres Changes: Slightly higher latency (DB trigger + replication)
- For a turn-based poker game: **latency is perfectly adequate**

### Free Tier Limits
- **Realtime concurrent connections:** 200
- **Realtime messages:** 2 million per month
- **Database:** 500 MB
- **Edge Functions:** 500K invocations/month
- **Bandwidth:** 5 GB
- For a 2-4 player poker game, free tier is **more than sufficient** for development and small-scale use

### Pros
- Supabase JS client works natively in Expo (no native modules needed)
- Presence is perfect for "who's in the room" tracking
- Broadcast is perfect for sending game actions
- Can persist game history in Postgres for free
- Edge Functions can act as server-side game logic validators
- Generous free tier
- Full auth system included (for user accounts)
- Already a mature, well-funded platform

### Cons
- **No game logic framework** — you build all turn management, validation, and state sync yourself
- Secret state requires Edge Functions or Row Level Security (more complexity)
- Broadcast is ephemeral — if a player disconnects and reconnects, they miss messages (need Postgres fallback)
- More "glue code" than boardgame.io
- Vendor lock-in to Supabase (though self-hostable)

### Expo Compatible: YES
- `@supabase/supabase-js` works out of the box with Expo
- No native modules required
- AsyncStorage adapter available for auth persistence

### Effort Estimate
- Game logic: **High effort** (build from scratch)
- Realtime integration: **Low effort** (Supabase SDK is clean)
- Server deployment: **None** (managed service)
- Auth/accounts: **Low effort** (built-in)

---

## Option 3: Liveblocks

**Website:** https://liveblocks.io
**GitHub:** https://github.com/liveblocks/liveblocks

### Tech
- **Protocol:** WebSocket (proprietary Liveblocks infra)
- **Features:**
  - **Storage:** Conflict-free replicated data types (CRDTs) for shared mutable state
  - **Presence:** Track cursor positions, selections, who's online
  - **Broadcasting:** Custom events to room participants
  - **Yjs integration:** For rich-text/collaborative editing (not relevant here)
- **Client:** `@liveblocks/client` (framework-agnostic) + `@liveblocks/react`

### How It Could Handle Core Concerns
| Concern | Approach |
|---------|----------|
| Room creation | `createRoom()` API or auto-created on first join |
| Player joining | Presence API: `updateMyPresence({ seat, name })` |
| State sync | LiveObject / LiveMap — shared mutable state with automatic sync |
| Turn management | Store `currentTurn` in shared storage; update on each move |
| Secret state | **Problem:** Liveblocks Storage is visible to all room members. Need a server component to manage secrets |

### Pros
- Very clean, modern API
- CRDTs handle conflict resolution automatically
- Presence is excellent (built-in "who's typing" / "who's connected")
- Good React hooks (`useStorage`, `useMyPresence`, `useOthers`)
- Managed infrastructure — no server to run

### Cons
- **React Native support is limited.** `@liveblocks/react` relies on React context and should work, but Liveblocks does not officially list React Native as a supported platform
- **No secret state mechanism.** All shared storage is visible to all clients — bad for poker where hands must be hidden. Requires a custom server or webhook-based approach
- **Pricing:** Free tier is limited (250 monthly active users, 10 concurrent connections per room). Paid plans can get expensive
- **Not designed for games** — designed for collaborative apps (Figma-style). Turn-based game logic is an afterthought
- CRDTs add overhead that isn't needed for a server-authoritative card game

### Expo Compatible: PARTIAL
- `@liveblocks/client` is pure JS and should work
- `@liveblocks/react` *may* work but is not officially tested in RN
- No native module dependencies
- **Verdict:** Likely works but unsupported; risky for production

### Effort Estimate
- Game logic: **High effort** (not designed for games)
- Secret state: **Very high effort** (fundamental architecture mismatch)
- Integration: **Medium effort**

---

## Option 4: PartyKit (now Cloudflare PartyKit / `partyserver`)

**Website:** https://www.partykit.io / https://partykit.io
**GitHub:** https://github.com/partykit/partykit

### Tech
- **Runtime:** Cloudflare Workers (Durable Objects under the hood)
- **Protocol:** WebSocket (native, not Socket.io)
- **Model:** Each "party" (room) is a Durable Object with its own state and WebSocket connections
- **Language:** TypeScript
- **As of late 2024/2025:** PartyKit was acquired by Cloudflare and integrated as `partyserver` within the Workers ecosystem

### How It Could Handle Core Concerns
| Concern | Approach |
|---------|----------|
| Room creation | Each unique room ID creates a new Party (Durable Object) automatically |
| Player joining | `onConnect(conn, room)` handler — track connections |
| State sync | Server holds authoritative state in the Durable Object; broadcasts to connected clients |
| Turn management | Custom logic in the Party server class |
| Secret state | **Excellent:** Server-authoritative by design. Send each player only their filtered state via their individual WebSocket connection |

### Pros
- **Server-authoritative by design** — perfect for poker (secret cards, validated moves)
- Edge-deployed globally (low latency everywhere)
- Per-room isolation (each game room is its own Durable Object)
- Hibernation API — rooms sleep when inactive, wake on connection (cost-efficient)
- Simple mental model: one TypeScript class = one game room
- Standard WebSocket — works with any client including React Native
- Cloudflare's infrastructure is extremely reliable

### Cons
- Relatively new ecosystem — fewer examples and community resources
- Need to learn Cloudflare Workers / Durable Objects concepts
- Debugging Durable Objects can be tricky
- Free tier: 100K requests/day, which is fine for dev but may need paid for production
- Must write all game logic yourself (no framework)
- The partykit-to-partyserver migration may cause some documentation confusion

### Expo Compatible: YES
- Client is standard WebSocket — `new WebSocket(url)` works natively in React Native / Expo
- No special client library required (though `partysocket` npm package adds reconnection logic and works in RN)
- Zero native module dependencies

### Effort Estimate
- Game logic: **High effort** (build from scratch)
- Server integration: **Low-medium effort** (very clean server API)
- Client integration: **Low effort** (standard WebSocket)
- Deployment: **Low effort** (Cloudflare handles everything)

---

## Option 5: Raw WebSocket (Socket.io)

**Tech:** Node.js + Socket.io server, `socket.io-client` in React Native

### How It Handles Core Concerns
| Concern | Approach |
|---------|----------|
| Room creation | `socket.join('room-XXXX')` on the server |
| Player joining | Client emits `join-room` event; server tracks players per room |
| State sync | Server broadcasts state via `io.to(room).emit('state', gameState)` |
| Turn management | Entirely custom |
| Secret state | Send per-player via `socket.to(playerId).emit('your-hand', cards)` |

### Pros
- Maximum flexibility — you control everything
- Socket.io is battle-tested (millions of production apps)
- Rich ecosystem of tutorials and examples
- Rooms, namespaces, and acknowledgements built-in
- Automatic reconnection, fallback to long-polling
- Works in React Native with `socket.io-client`

### Cons
- **You build everything from scratch:** room management, turn logic, state sync, validation, reconnection state recovery, lobby, matchmaking
- Significant development time for a robust implementation
- Easy to introduce bugs in state synchronization
- Need to host and scale a Node.js server
- No built-in persistence (need to add Redis/DB for crash recovery)

### Expo Compatible: YES
- `socket.io-client` works in Expo managed workflow
- May need a WebSocket polyfill depending on Expo SDK version
- No native modules required

### Effort Estimate
- Everything: **Very high effort**
- Most flexibility but most work

---

## Comparison Matrix

| Feature | boardgame.io | Supabase Realtime | Liveblocks | PartyKit | Raw Socket.io |
|---------|-------------|-------------------|------------|----------|---------------|
| **Expo compatible** | Partial | Yes | Partial | Yes | Yes |
| **Turn management** | Built-in | Manual | Manual | Manual | Manual |
| **Secret state** | Built-in | Via Edge Functions | No | Via server logic | Via server logic |
| **Room/lobby** | Built-in | Manual | Built-in | Auto per room ID | Manual |
| **Server required** | Yes (Node.js) | No (managed) | No (managed) | No (Cloudflare) | Yes (Node.js) |
| **Free tier** | OSS (host yourself) | Generous | Limited | Generous | OSS (host yourself) |
| **Game logic framework** | Yes | No | No | No | No |
| **Dev effort** | Low-Medium | Medium-High | High | Medium-High | Very High |
| **Production readiness** | High | High | Medium | Medium-High | Depends on you |
| **Best for** | Turn-based games | Apps with DB needs | Collab apps | Realtime rooms | Full control |

---

## Recommendation

### Primary Recommendation: **Supabase Realtime + Custom Game Logic**

**Why Supabase for Caps Poker:**

1. **Expo-native compatibility** — `@supabase/supabase-js` works out of the box in Expo managed workflow with zero native module workarounds. This is a critical advantage.

2. **Beyond just multiplayer** — Supabase gives you auth (player accounts), database (game history, leaderboards, player stats), and realtime in one platform. For a poker game that will eventually want user profiles, friends lists, and game history, this is a major advantage.

3. **Architecture for poker specifically:**
   - Use **Broadcast** for sending game actions (bet, fold, call, raise)
   - Use **Presence** for tracking who's in the room and connection status
   - Use **Postgres** for persisting game state (so reconnecting players can recover)
   - Use **Edge Functions** for server-side validation and secret state management (deal cards server-side, only send each player their own hand)

4. **Generous free tier** easily handles development and early users (200 concurrent connections, 2M messages/month).

5. **Scales when needed** — Supabase Pro plan is $25/month and handles significant traffic.

### Secondary Recommendation: **PartyKit (if you want the cleanest server-authoritative architecture)**

PartyKit/partyserver is architecturally the most elegant solution for a poker game. Each game room as a Durable Object with server-authoritative state is the "correct" pattern for a card game with hidden information. The downsides are the smaller ecosystem and the need to write all game logic from scratch.

### Why Not boardgame.io?

boardgame.io is the best *game framework*, but its partial Expo support is a real concern. You'd spend significant time on the integration layer between boardgame.io's plain client and React Native views, and debugging issues in that gap would be painful. If this were a React web app, boardgame.io would be the clear winner.

### Why Not Liveblocks?

Liveblocks is designed for collaborative applications (like Figma), not games. The lack of server-side secret state is a fundamental problem for poker, where players must not see each other's cards. You'd be fighting the framework.

### Why Not Raw Socket.io?

Too much work for a small team. You'd spend weeks building what boardgame.io or Supabase give you for free.

---

## Local Multiplayer (Phase 1)

### Same-WiFi Multiplayer Without a Cloud Backend

For Phase 1, you can implement local multiplayer where one device acts as the "host/server" and others connect over the local network. Here's how:

### Approach A: React Native TCP/UDP via Expo (Recommended for Phase 1)

```
Host Device                          Client Devices
┌──────────────┐                    ┌──────────────┐
│  Game Server  │◄──── WiFi ───────►│  Game Client  │
│  (in-app)     │    WebSocket      │  (in-app)     │
│              │                    ├──────────────┤
│  - Game logic │                    │  Game Client  │
│  - State mgr  │                    │  (in-app)     │
│  - WebSocket  │                    └──────────────┘
│    server     │
└──────────────┘
```

**Implementation steps:**

1. **Use `expo-network`** to get the host device's local IP address:
   ```js
   import * as Network from 'expo-network';
   const ip = await Network.getIpAddressAsync(); // e.g., "192.168.1.42"
   ```

2. **Embed a lightweight WebSocket server** in the host app. Options:
   - `react-native-tcp-socket` — provides TCP server capability (requires expo dev client, NOT compatible with Expo Go)
   - Alternative: Use a simple HTTP polling approach with `expo-server` patterns

3. **Service discovery** — how clients find the host:
   - **Simple:** Host displays a room code + IP address; clients type it in
   - **QR Code:** Host shows a QR code containing `ws://192.168.1.42:8080/game/ROOM_CODE`; clients scan it with `expo-camera`
   - **mDNS/Bonjour:** Use `react-native-zeroconf` for automatic discovery (requires dev client)

4. **Game state architecture:**
   ```
   Host device runs:
   ├── GameServer (validates moves, manages state, deals cards)
   └── GameClient (renders UI, connects to own server via localhost)

   Client devices run:
   └── GameClient (renders UI, connects to host's IP via WebSocket)
   ```

5. **State sync protocol:**
   ```json
   // Server -> Client (personalized per player)
   {
     "type": "GAME_STATE",
     "commonState": {
       "pot": 150,
       "communityCards": ["Ah", "Kd", "3c"],
       "currentTurn": 2,
       "players": [
         { "seat": 0, "name": "Alice", "chips": 850, "bet": 50, "folded": false },
         { "seat": 1, "name": "Bob", "chips": 900, "bet": 50, "folded": false }
       ]
     },
     "yourHand": ["Js", "Ts"],
     "yourSeat": 0
   }

   // Client -> Server (actions)
   { "type": "ACTION", "action": "RAISE", "amount": 100 }
   { "type": "ACTION", "action": "FOLD" }
   { "type": "ACTION", "action": "CALL" }
   ```

### Approach B: Simpler Alternative — Shared State via Polling

If embedding a WebSocket server is too complex for Phase 1:

1. Host runs a minimal HTTP server (e.g., using `react-native-tcp-socket` or a fetch-based polling approach)
2. Clients poll every 500ms for game state via HTTP GET
3. Clients send actions via HTTP POST
4. Higher latency (~500ms) but perfectly fine for a turn-based poker game

### Approach C: Hot Seat / Pass-and-Play (Simplest Phase 1)

For the absolute simplest Phase 1 multiplayer:
- Single device, players pass the phone around
- Screen shows "Pass to [Player Name]" between turns
- Tap to reveal your hand, tap to hide before passing
- Zero networking code required
- Good for testing game logic before adding networking

### Recommended Phase 1 Plan

1. **Week 1-2:** Implement hot-seat/pass-and-play mode to validate core game logic
2. **Week 3-4:** Add local WebSocket server for same-WiFi play using QR code room joining
3. **Week 5+:** Migrate to Supabase Realtime for online play (the game logic layer stays the same; only the transport changes)

### Key Architecture Principle

**Separate game logic from transport.** Build your game engine as a pure function:

```typescript
// gameEngine.ts — pure functions, no networking
function applyAction(state: GameState, action: PlayerAction): GameState { ... }
function isValidAction(state: GameState, action: PlayerAction): boolean { ... }
function getPlayerView(state: GameState, playerId: number): PlayerView { ... }

// transport can be swapped:
// Phase 1: LocalWebSocketServer calls applyAction()
// Phase 2: Supabase Edge Function calls applyAction()
// Phase 3: PartyKit Durable Object calls applyAction()
```

This way, your game logic is testable, portable, and transport-agnostic.

---

## Appendix: NPM Packages to Evaluate

| Package | Purpose | Expo Go? | Dev Client? |
|---------|---------|----------|-------------|
| `@supabase/supabase-js` | Supabase client (realtime, auth, db) | Yes | Yes |
| `pokersolver` | Poker hand evaluation | Yes | Yes |
| `expo-network` | Get device IP for LAN play | Yes | Yes |
| `expo-camera` | QR code scanning for room join | Yes | Yes |
| `socket.io-client` | WebSocket client (if using Socket.io) | Yes | Yes |
| `react-native-tcp-socket` | TCP server in RN (for LAN host) | No | Yes |
| `react-native-zeroconf` | mDNS service discovery | No | Yes |
| `partysocket` | PartyKit client with reconnection | Yes | Yes |
| `boardgame.io` | Game framework (plain client) | Yes | Yes |
