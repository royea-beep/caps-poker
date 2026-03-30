# G-PROMPT: CAPS — Build Sit & Go + Remove Battle Pass
## For Claude Code agent in C:\Projects\caps-poker

---

## TASK 1: Remove Battle Pass button from home screen

The Battle Pass button was added in commit 05e907b as a grayed "Coming Soon" button. 
**Remove it entirely** — no trace in UI. The `battle_pass_enabled` config is `false`, table is dropped.

- Search for `battle_pass` or `Battle Pass` in all files
- Remove any button, component, or reference to Battle Pass from UI
- Keep any config reads (they'll just return false) but remove visible elements
- DO NOT break existing layout — test that home screen still looks correct

---

## TASK 2: Build Sit & Go game mode UI

### What exists (backend):
- `sit_and_go_sessions` table: id, room_code, status (waiting/playing/finished), max_players (6), current_players, buy_in (100), prize_pool
- `sit_and_go_players` table: id, session_id, device_id, player_name, chips (1000 start), is_eliminated, finish_position
- `app_config.sit_n_go_enabled = true`
- RPCs:
  - `join_sit_n_go(device_id TEXT, player_name TEXT)` → joins or creates a session, deducts 100 chip buy-in
  - `sng_eliminate(device_id TEXT, session_id UUID)` → marks player eliminated, awards prizes when 1 left
  - `get_sng_status(session_id UUID)` → returns session + all players

### Prize structure:
- 6 players × 100 chips buy-in = 600 chip prize pool
- 1st place: 360 chips (60%)
- 2nd place: 180 chips (30%)  
- 3rd place: 60 chips (10%)

### Screens to build:

#### 1. Sit & Go Lobby (app/sit-n-go.tsx)
- Shows current open sessions (poll `sit_and_go_sessions` where status='waiting')
- "Join Game (100 💰)" button — calls `join_sit_n_go(deviceId, playerName)`
- If insufficient chips → show alert with current balance
- After joining → navigate to waiting room

#### 2. Waiting Room (app/sit-n-go/[id].tsx)  
- Shows room code at top (6-char code for sharing)
- Player list (1-6) with names, shows who joined
- "Waiting for players... X/6"
- Poll `get_sng_status` every 3 seconds
- When status changes to 'playing' → navigate to game

#### 3. Sit & Go Game
- **Reuse existing GameScreen** but with SNG context:
  - Show "Sit & Go" badge at top
  - Show player count remaining (e.g., "4/6 remaining")
  - Show prize pool
  - When player loses all chips → call `sng_eliminate(deviceId, sessionId)`
  - On elimination → show position and prize

#### 4. Results Screen (after SNG finishes)
- Show final standings (1st, 2nd, 3rd with prizes)
- Gold/Silver/Bronze styling
- "Back to Lobby" button

### Navigation from Home:
- The existing Sit & Go button should change from grayed "Coming Soon" to active
- If `sit_n_go_enabled === true` → show active button, navigate to lobby
- Button style: Blue accent, "Sit & Go (100 💰)" with chip icon

### Important constraints:
- Device-based auth (use deviceId, not user UUID)
- Hebrew-first labels with English fallback
- Must work on iPhone 17 Pro Max AND smaller screens
- Follow existing app styling patterns
- Do NOT overload the game screen — SNG is just the normal game with elimination tracking

### Tests:
- join_sit_n_go with insufficient chips → should show error
- join_sit_n_go when already in session → should show error  
- Elimination flow → correct position and prizes
- Prize distribution → correct chip amounts credited

---

## VERIFICATION AFTER BOTH TASKS:
1. `npm test` — all tests must pass
2. TypeScript must compile clean
3. Home screen: NO Battle Pass button visible
4. Home screen: Sit & Go button is active (not grayed)
5. Full Sit & Go flow: Join → Wait → Play → Eliminate → Results
