# You are continuing the CAPS POKER project.
# PARALLEL SPRINT — 7 tasks simultaneously.
# Launch all 7 agents at once.
# Read MEMORY.md and confirm Iron Rules before starting.

---

## Iron Rules Confirmation
- Rule 1: React Native + Expo only ✓
- Rule 2: iOS portrait only ✓
- Rule 3: All params runtime-configurable ✓
- Rule 4: Full Omaha evaluation ✓
- Rule 5: Bot is random only ✓
- Rule 6: No backend for single-player — local storage only ✓
- Rule 7: Local multiplayer via react-native-tcp-socket (host as WebSocket server) ✓
- Rule 8: Internet multiplayer via Supabase Realtime (Phase 2, not this sprint) ✓

---

## CONTEXT
Sprint 6 implements local multiplayer (same WiFi).
Architecture:
- Host device runs a WebSocket server (react-native-tcp-socket)
- Guest devices connect via 4-digit room code
- Host is source of truth — deals cards, evaluates hands, broadcasts results
- Each player arranges their own cards locally
- Ready signals collected by host, then reveal sequence runs

All multi-player game logic is already built (Sprint 05).
This sprint wires it into real networking.

---

## TASK 1 — Install + Configure Networking Packages (CRITICAL)
Agent: network-installer

A1. Install required packages:
    ```
    npx expo install react-native-tcp-socket
    npm install --legacy-peer-deps uuid
    npm install --save-dev @types/uuid
    ```

A2. Read LOCAL_MULTIPLAYER_DESIGN.md fully — understand the message protocol.

A3. Create `constants/networkConfig.ts`:
    ```typescript
    export const NETWORK_CONFIG = {
      port: 8765,
      roomCodeLength: 4,
      connectionTimeoutMs: 30000,
      heartbeatIntervalMs: 5000,
      reconnectAttempts: 3,
    };
    
    export type MessageType =
      | 'ROOM_JOIN'
      | 'ROOM_JOIN_ACK'
      | 'ROOM_READY'
      | 'GAME_START'
      | 'CARDS_DEALT'
      | 'PLAYER_READY'
      | 'ALL_READY'
      | 'BOARD_REVEAL'
      | 'HAND_COMPLETE'
      | 'HEARTBEAT'
      | 'ERROR'
      | 'PLAYER_DISCONNECTED';
    
    export interface NetworkMessage {
      type: MessageType;
      payload: unknown;
      senderId: string;
      timestamp: number;
    }
    ```

A4. Create `utils/roomCode.ts`:
    ```typescript
    // Generate a 4-digit numeric room code
    export function generateRoomCode(): string {
      return Math.floor(1000 + Math.random() * 9000).toString();
    }
    
    // Map room code to host IP (stored in a simple in-memory registry on host)
    // Guests will need to manually enter the code shown on host screen
    // In Phase 2 this will use a real registry — for now just the code confirms connection
    ```

A5. Run `npx tsc --noEmit 2>&1` — fix any errors.

---

## TASK 2 — Host WebSocket Server (CRITICAL)
Agent: host-server

A1. Create `utils/gameServer.ts` — WebSocket server that runs on the host device:

```typescript
import TcpSocket from 'react-native-tcp-socket';
import { NetworkMessage, MessageType, NETWORK_CONFIG } from '../constants/networkConfig';
import { Player } from '../types/gameTypes';

export interface ConnectedPlayer {
  id: string;
  name: string;
  socket: any;
  isReady: boolean;
  isHost: boolean;
}

export interface GameServerCallbacks {
  onPlayerJoined: (player: ConnectedPlayer) => void;
  onPlayerReady: (playerId: string, boardAssignments: Card[][]) => void;
  onPlayerDisconnected: (playerId: string) => void;
  onError: (error: Error) => void;
}

export class GameServer {
  private server: any = null;
  private clients: Map<string, ConnectedPlayer> = new Map();
  private callbacks: GameServerCallbacks;
  
  constructor(callbacks: GameServerCallbacks) {
    this.callbacks = callbacks;
  }
  
  start(port: number = NETWORK_CONFIG.port): Promise<string> {
    // Start TCP server, return host IP address
  }
  
  broadcast(message: NetworkMessage): void {
    // Send to all connected clients
  }
  
  sendTo(playerId: string, message: NetworkMessage): void {
    // Send to specific client
  }
  
  stop(): void {
    // Close all connections and server
  }
  
  getHostIP(): string {
    // Return device's local WiFi IP
  }
}
```

A2. Implement all GameServer methods:
    - `start()`: creates TcpSocket server on given port, returns local IP
    - `broadcast()`: sends JSON message to all connected clients
    - `sendTo()`: sends to specific client by playerId
    - `stop()`: closes server and all client sockets
    - `getHostIP()`: uses react-native-tcp-socket to get local IP, or falls back to 'localhost'

A3. Handle incoming messages in the server:
    - `ROOM_JOIN`: new player connects — assign ID, send `ROOM_JOIN_ACK`
    - `PLAYER_READY`: player finished arranging — store their card assignments
    - `HEARTBEAT`: update last-seen timestamp

A4. Handle disconnections gracefully:
    - If host disconnects: all clients see error screen
    - If guest disconnects mid-arrangement: auto-fill their cards randomly
    - If guest disconnects during reveal: show them as "disconnected" but continue

A5. Run `npx tsc --noEmit 2>&1` — fix any errors.

---

## TASK 3 — Client Connection (CRITICAL)
Agent: client-connector

A1. Create `utils/gameClient.ts` — WebSocket client for guest devices:

```typescript
import TcpSocket from 'react-native-tcp-socket';
import { NetworkMessage, NETWORK_CONFIG } from '../constants/networkConfig';

export interface GameClientCallbacks {
  onConnected: () => void;
  onGameStart: (dealData: CardsDealtPayload) => void;
  onAllReady: () => void;
  onBoardReveal: (revealData: BoardRevealPayload) => void;
  onHandComplete: (result: HandCompletePayload) => void;
  onDisconnected: () => void;
  onError: (error: Error) => void;
}

export class GameClient {
  private socket: any = null;
  private callbacks: GameClientCallbacks;
  private playerId: string = '';
  
  constructor(callbacks: GameClientCallbacks) {
    this.callbacks = callbacks;
  }
  
  connect(hostIP: string, port: number): Promise<void>
  send(message: NetworkMessage): void
  disconnect(): void
}
```

A2. Implement all GameClient methods:
    - `connect()`: connects to host TCP server, sends ROOM_JOIN, waits for ROOM_JOIN_ACK
    - `send()`: sends JSON message to host
    - `disconnect()`: closes socket cleanly

A3. Handle all incoming message types from host:
    - `ROOM_JOIN_ACK`: store assigned playerId and player list
    - `GAME_START` + `CARDS_DEALT`: receive your 16/12/8 cards
    - `ALL_READY`: host confirmed all players ready — start reveal
    - `BOARD_REVEAL`: reveal specific board with results
    - `HAND_COMPLETE`: hand over, show results
    - `PLAYER_DISCONNECTED`: show notification

A4. Implement heartbeat:
    - Client sends `HEARTBEAT` every 5 seconds
    - If no response for 15 seconds, trigger onDisconnected

A5. Run `npx tsc --noEmit 2>&1` — fix any errors.

---

## TASK 4 — Lobby Screens (IMPORTANT)
Agent: lobby-ui

A1. Create `app/lobby/host.tsx` — Host lobby screen:
    Layout:
    - "CAPS POKER" title
    - "Room Code: XXXX" — large, prominent display (4 digits)
    - "Your IP: 192.168.x.x" — shown below code
    - Player list: shows connected players with their names
    - "Waiting for players..." status or "All players ready — Start Game!"
    - Player count selector: 2 / 3 / 4 players
    - "Start Game" button (enabled when enough players connected)
    - "Cancel" button

A2. Create `app/lobby/join.tsx` — Join lobby screen:
    Layout:
    - "JOIN GAME" title
    - "Enter Host IP" text input (e.g., 192.168.1.5)
    - "Enter Room Code" text input (4 digits)
    - "Connect" button
    - Connection status: Connecting... / Connected! / Error
    - Once connected: show player list waiting for host to start

A3. Update `app/index.tsx` — Home screen:
    Add two new buttons below "New Hand (vs Bot)":
    - "Host Game" → navigate to /lobby/host
    - "Join Game" → navigate to /lobby/join
    Keep existing "New Hand (vs Bot)" button intact.

A4. Create `app/lobby/_layout.tsx` for the lobby sub-route.

A5. Run `npx tsc --noEmit 2>&1` — fix any errors.

---

## TASK 5 — Multiplayer Game Screen (IMPORTANT)
Agent: multiplayer-game-ui

A1. Create `app/multiplayer-game.tsx` — multiplayer version of the game screen.

A2. This screen is used by BOTH host and guests. It receives via props/params:
    - `isHost: boolean`
    - `playerIndex: number` (0 = human player, determines which cards to show)
    - `playerCount: number`
    - `gameSession: GameSession`

A3. Arrangement phase (same as single-player but only shows YOUR cards):
    - Show YOUR 16/12/8 cards at bottom
    - Show boards in center (only your card slots are interactive)
    - Show other players' card slots as face-down placeholders
    - Timer counts down
    - Ready button sends PLAYER_READY message to host (or host's GameServer)

A4. Reveal phase:
    - Driven by BOARD_REVEAL messages from host
    - Each reveal shows all players' cards for that board
    - Highlight winning hand
    - Show chip delta per player

A5. On HAND_COMPLETE:
    - Navigate to summary screen with full results
    - Show all players' chip changes

A6. Run `npx tsc --noEmit 2>&1` — fix any errors.

---

## TASK 6 — Multiplayer State in Zustand (IMPORTANT)
Agent: multiplayer-store

A1. Read `store/gameStore.ts` fully.

A2. Add multiplayer state to gameStore:
    ```typescript
    // Multiplayer state (NOT persisted)
    multiplayerMode: 'none' | 'host' | 'guest';
    roomCode: string | null;
    hostIP: string | null;
    connectedPlayers: ConnectedPlayerInfo[];
    gameSession: GameSession | null;
    
    // Actions
    setMultiplayerMode: (mode: 'none' | 'host' | 'guest') => void;
    setRoomCode: (code: string) => void;
    setHostIP: (ip: string) => void;
    setConnectedPlayers: (players: ConnectedPlayerInfo[]) => void;
    setGameSession: (session: GameSession | null) => void;
    ```

A3. Ensure multiplayer state is NOT persisted (only chips and config are persisted).
    Use `partialize` in persist middleware to exclude multiplayer state.

A4. Add `ConnectedPlayerInfo` type to `types/gameTypes.ts`:
    ```typescript
    export interface ConnectedPlayerInfo {
      id: string;
      name: string;
      isHost: boolean;
      isReady: boolean;
      chips: number;
    }
    ```

A5. Run `npx tsc --noEmit 2>&1` — fix any errors.

---

## TASK 7 — Integration + Iron Rules Update (IMPORTANT)
Agent: integration

A1. Wire up lobby screens to GameServer/GameClient:
    - `app/lobby/host.tsx`: instantiate GameServer, show room code, handle player connections
    - `app/lobby/join.tsx`: instantiate GameClient, connect to host, wait for game start

A2. Wire up host game flow:
    When host taps "Start Game":
    1. Call dealNewHand(playerCount, config)
    2. Send GAME_START + CARDS_DEALT to each player (send only their cards)
    3. Start arrangement timer
    4. Collect PLAYER_READY messages
    5. When all ready (or timer expires): run evaluateAllBoards + calculateChipDeltas
    6. Send BOARD_REVEAL messages sequentially (one per boardRevealDuration)
    7. Send HAND_COMPLETE with full results
    8. Update chips in store

A3. Wire up guest game flow:
    On CARDS_DEALT received:
    - Navigate to multiplayer-game.tsx
    - Load received cards into arrangement UI
    On PLAYER_READY sent:
    - Disable arrangement UI, show "Waiting for others..."
    On BOARD_REVEAL:
    - Animate board reveal
    On HAND_COMPLETE:
    - Navigate to summary

A4. Update MEMORY.md:
    - Confirm Rule 7 and Rule 8 as locked
    - Add all new files to file structure
    - Update current state: "Sprint 06 complete — local multiplayer implemented"
    - Update open items

A5. Run final checks:
    - `npx tsc --noEmit 2>&1`
    - `npx jest 2>&1 | tail -5`
    - `git add -A`
    - `git commit -m "sprint-06: local multiplayer — host server, client, lobby, game screen"`
    - `cp MEMORY.md "C:\Users\royea\.claude\projects\C--Projects-Caps\memory\MEMORY.md"`

---

## FINAL STEPS

1. `npx tsc --noEmit 2>&1` — zero errors required
2. `npx jest 2>&1 | tail -5` — 31/31 required
3. `node scripts/preflight-check.js 2>&1`
4. Update MEMORY.md
5. `git add -A`
6. `git commit -m "sprint-06: local multiplayer — host server, client, lobby, game screen"`
7. `cp MEMORY.md "C:\Users\royea\.claude\projects\C--Projects-Caps\memory\MEMORY.md"`
8. Report in table format

---

## DO NOT
- Change Rules 1-6
- Implement internet multiplayer (Supabase) — that's Sprint 7
- Break existing 31/31 tests
- Remove or modify the single-player bot game — keep it working
- Use hardcoded values — always read from config and networkConfig
- Ask the user questions mid-execution
- Skip MEMORY.md update
