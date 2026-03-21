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
- Rule 5: Bot is random only (for now) ✓
- Rule 6: No backend YET — local multiplayer coming next ✓

---

## CONTEXT
Two parallel tracks this sprint:
- Track A (Tasks 1-4): Full game simulation — verify 2/3/4 player game logic works end to end
- Track B (Tasks 5-7): OSS audit — research how real multiplayer card games are built

---

## TRACK A — SIMULATION

## TASK 1 — Simulation Engine (CRITICAL)
Agent: simulation-engine

A1. Create `utils/simulate.ts` — a headless game simulator that runs full hands with no UI:

```typescript
interface SimulationResult {
  playerCount: number;
  boardCount: number;
  boards: {
    index: number;
    winner: number; // player index, -1 for tie
    playerHands: { rank: string; score: number }[];
    potWon: number;
  }[];
  completeWinner: number | null; // player index who won all boards, -1 if none
  chipDeltas: number[]; // net chips per player
  durationMs: number;
}

export function simulateHand(playerCount: 2 | 3 | 4, config: GameConfig): SimulationResult
```

A2. Implement simulateHand:
    - Create fresh deck, shuffle
    - Deal cards per player count rules:
      * 2 players: 16 cards each, 4 boards
      * 3 players: 12 cards each, 3 boards
      * 4 players: 8 cards each, 2 boards
    - Each board: 3 open + 2 closed cards from deck
    - Each player randomly assigns their cards to boards (4 per board for 2p, 4 per board for 3p, 4 per board for 4p)
    - Evaluate all boards using existing evaluateOmahaHand
    - Calculate chip deltas: winner gets potPerBoard * playerCount, losers lose potPerBoard
    - Check COMPLETE: did any player win ALL boards?
    - Return full SimulationResult

A3. Verify card math is correct:
    - 2 players: 2×16=32 player cards + 4×5=20 board cards = 52 ✓
    - 3 players: 3×12=36 player cards + 3×5=15 board cards = 51 (1 leftover, discard) ✓
    - 4 players: 4×8=32 player cards + 2×5=10 board cards = 42 (10 leftover, discard) ✓
    Handle the leftover cards gracefully.

A4. Add guard: each player must place exactly 4 cards per board. In simulation, distribute randomly but ensure exactly 4 per board per player.

A5. Export simulateHand from utils/simulate.ts and run a quick smoke test:
    ```typescript
    const result = simulateHand(2, DEFAULT_CONFIG);
    console.log(JSON.stringify(result, null, 2));
    ```

---

## TASK 2 — Simulation Test Suite (CRITICAL)
Agent: simulation-tester

A1. Wait for Task 1 to create utils/simulate.ts, then create `utils/__tests__/simulate.test.ts`

A2. Write tests for 2-player simulation:
    - Run 100 hands: verify no crashes
    - Verify chipDeltas always sum to 0 (zero-sum game)
    - Verify each board has exactly one winner or tie
    - Verify COMPLETE bonus math: if completeWinner !== null, their delta includes bonus
    - Verify deck integrity: no duplicate cards across all hands

A3. Write tests for 3-player simulation:
    - Run 100 hands: verify no crashes
    - Verify chipDeltas sum to 0
    - Verify board count = 3
    - Verify each player had exactly 12 cards total

A4. Write tests for 4-player simulation:
    - Run 100 hands: verify no crashes
    - Verify chipDeltas sum to 0
    - Verify board count = 2
    - Verify each player had exactly 8 cards total

A5. Run all tests: `npx jest utils/__tests__/simulate.test.ts 2>&1`
    Report: X/Y tests passed. Fix any failures.

---

## TASK 3 — Multi-Player Game Logic Refactor (IMPORTANT)
Agent: multiplayer-logic

A1. Read `utils/gameLogic.ts`, `store/gameStore.ts`, `types/gameTypes.ts` fully.

A2. The current game logic only supports 1 player vs 1 bot. Refactor `utils/gameLogic.ts` to support N players (2-4):

    Current BoardState:
    ```typescript
    playerCards: Card[];
    botCards: Card[];
    ```
    
    New BoardState:
    ```typescript
    playerCards: Card[][]; // index 0 = human, 1..N = bots/opponents
    ```

A3. Update `types/gameTypes.ts`:
    ```typescript
    export interface Player {
      id: string;
      name: string;
      isHuman: boolean;
      chips: number;
      cards: Card[]; // hand cards not yet placed
    }
    
    export interface GameSession {
      players: Player[];
      boards: BoardState[];
      phase: GamePhase;
      config: GameConfig;
    }
    ```

A4. Update `utils/gameLogic.ts`:
    - `dealNewHand(playerCount, config)` — deals correctly for 2/3/4 players
    - `evaluateAllBoards(boards, players)` — evaluates N players per board
    - `calculateChipDeltas(boardResults, playerCount, config)` — zero-sum chip math
    - All functions must be pure (no side effects)

A5. Run `npx tsc --noEmit 2>&1` — fix all TypeScript errors from the refactor.

---

## TASK 4 — Simulation Report UI (IMPORTANT)
Agent: simulation-ui

A1. Create `app/simulate.tsx` — a debug screen that runs simulations and shows results.

A2. Screen layout:
    - Header: "SIMULATION MODE"
    - Three buttons: "Run 2P (100 hands)", "Run 3P (100 hands)", "Run 4P (100 hands)"
    - Results panel showing:
      * Total hands run
      * Zero-sum verified: ✅/❌
      * COMPLETE rate: X%
      * Average chips per hand delta
      * Any errors found
    - "Run All" button that runs all three sequentially
    - Loading state while running

A3. Add navigation to simulate screen from settings screen — add a "Simulation Mode" button at the bottom of settings.tsx

A4. The simulation must run on a background thread (use setTimeout with chunks of 10 hands to avoid blocking UI).

A5. Run `npx tsc --noEmit 2>&1` — fix any errors.

---

## TRACK B — OSS MULTIPLAYER AUDIT

## TASK 5 — GitHub OSS Research: Card Game Multiplayer (IMPORTANT)
Agent: oss-researcher

A1. Search the web for these specific repositories and read their README + key architecture files:

    Search queries to run:
    - "react native multiplayer card game websocket github"
    - "expo multiplayer realtime game socket.io github"  
    - "react native poker multiplayer open source"
    - "boardgame.io react native"

A2. For each relevant repo found, document:
    - Repo name + URL
    - Stars count
    - Tech stack (WebSocket? Socket.io? Firebase? Supabase? boardgame.io?)
    - How they handle: room creation, player joining, game state sync, turn management
    - Mobile-friendly? Expo-compatible?

A3. Specifically research boardgame.io (boardgame.io):
    - Read https://boardgame.io
    - Is it compatible with Expo/React Native?
    - Does it support 2-4 players?
    - Does it handle turn-based state sync?
    - What's the backend requirement?

A4. Research Supabase Realtime as multiplayer backend:
    - Read https://supabase.com/docs/guides/realtime
    - Can it handle game state sync for 2-4 players?
    - Latency characteristics?
    - Free tier limits?

A5. Research Liveblocks and Partykit as alternatives:
    - Which is most Expo-friendly?
    - Which has the simplest API for game state?

A6. Create `MULTIPLAYER_RESEARCH.md` with findings:
    ```markdown
    # Caps Poker — Multiplayer Architecture Research

    ## Option 1: [Name]
    Tech: ...
    Pros: ...
    Cons: ...
    Expo compatible: yes/no
    Estimated implementation: X days

    ## Option 2: ...

    ## Recommendation
    [Clear recommendation with reasoning]

    ## Local Multiplayer (Phase 1)
    How to implement same-WiFi multiplayer without a backend
    ```

---

## TASK 6 — Local Multiplayer Architecture Design (IMPORTANT)
Agent: local-multiplayer-architect

A1. Research React Native local networking options:
    - expo-local-authentication (not relevant, skip)
    - react-native-bonjour / mDNS for device discovery
    - WebSocket server running on host device (react-native-tcp-socket)
    - Peer-to-peer options

A2. Read `C:\Projects\royea-mobile-launch-kit\` for any networking utilities.
    Read `C:\Projects\shared-utils\` for any WebSocket or networking code.
    Read `C:\Projects\Wingman\` for any real-time features.

A3. Design the local multiplayer flow:
    ```
    Host device:
    1. Creates a room (generates 4-digit code)
    2. Starts a WebSocket server on local IP
    3. Shows room code on screen
    
    Guest device:
    1. Enters room code
    2. Discovers host IP via code
    3. Connects via WebSocket
    
    Game flow:
    - Host deals cards (source of truth)
    - Each player arranges their own cards
    - Host collects ready signals
    - Host runs evaluation
    - Host broadcasts results
    ```

A4. Write `LOCAL_MULTIPLAYER_DESIGN.md`:
    - Architecture diagram (ASCII)
    - Message protocol (JSON message types)
    - State sync strategy
    - Error handling (player disconnects mid-game)
    - Required npm packages

A5. Identify which packages from other projects in C:\Projects\ could help with this.

---

## TASK 7 — Iron Rules Update + Architecture Decision (IMPORTANT)
Agent: architect

A1. Read `MULTIPLAYER_RESEARCH.md` (from Task 5) and `LOCAL_MULTIPLAYER_DESIGN.md` (from Task 6).

A2. Read current `MEMORY.md`.

A3. Based on all research, write a clear recommendation for the multiplayer stack:
    - Phase 1 (local): which approach + packages
    - Phase 2 (internet): which backend service
    - Estimate time to implement each phase

A4. Propose new Iron Rules to add for multiplayer:
    - Rule 7: [Local multiplayer approach]
    - Rule 8: [Internet multiplayer backend]
    - These are PROPOSALS only — user must approve before they become locked

A5. Update `MEMORY.md`:
    - Add multiplayer architecture section
    - Add simulation results summary (from Track A)
    - Update open items
    - Add new files to file structure

---

## FINAL STEPS

1. `npx tsc --noEmit 2>&1` — zero errors required
2. `npx jest 2>&1 | tail -5` — all tests must pass
3. `git add -A`
4. `git commit -m "sprint-05: simulation engine, multiplayer logic refactor, OSS research"`
5. `cp MEMORY.md "C:\Users\royea\.claude\projects\C--Projects-Caps\memory\MEMORY.md"`
6. Full report per task in table format

---

## DO NOT
- Change any existing Iron Rules without user approval
- Break existing 12/12 hand evaluator tests
- Add UI to main game screens yet (multiplayer UI comes in sprint 6)
- Use hardcoded values — always read from config
- Ask the user questions mid-execution
- Skip MEMORY.md update
- Actually implement multiplayer yet — research and design only in Track B
