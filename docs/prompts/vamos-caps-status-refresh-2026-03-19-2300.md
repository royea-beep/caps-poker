VAMOS CAPS STATUS-REFRESH v2026-03-19-2300

Standing Orders: Fix autonomously. Never give user commands.

---

## TASK — Full status refresh + audit + simulation + graphics review

### STEP 1 — Current state
A1. git log --oneline -10
A2. cat app.json | grep -E "version|buildNumber"
A3. eas build:list --platform ios --limit 3
A4. curl -sk https://caps.ftable.co.il | grep "bundle\|version" | head -3

### STEP 2 — Bug audit: what was fixed, what's still open
B1. Read MEMORY.md in full
B2. Read docs/SESSION-2026-03-18.md
B3. Check git log for all auto-fix commits:
    git log --oneline --grep="auto-fix\|fix:\|perf:" | head -20
B4. Create a bug status table:
    For each known bug — was it fixed? verified on device? still open?
    Known bugs:
    - Splash screen missing
    - 8 second delay after READY
    - Cards cut off on iPhone 16
    - LEADERBOARD/SETTINGS button overflow
    - BugReporter opens on READY press
    - Version badge shows (?)
    - Cards too small on mobile web
    - Bot speed too slow (30s)
    - BEST card badge floating
    - WhatsApp bot not responding
    - WhatsApp bot no Hebrew
    - WhatsApp bot no image support
    - WhatsApp bot no audio support

### STEP 3 — Simulation: 500 concurrent users
C1. Read utils/gameLogic.ts — find evaluateAllBoards + calculateHandResultsMulti
C2. Run stress test:
    py -3.11 -c "
    import sys, time, statistics
    sys.path.insert(0, 'C:/Projects/Caps')

    # Simulate 500 games in sequence (single-threaded, measures pure compute time)
    # Each game: 2 players, 4 boards, full Omaha evaluation

    print('Loading game logic...')

    # Read and time the calculation
    import subprocess, json

    start = time.time()
    result = subprocess.run(
        ['npx', 'jest', '--testPathPattern', 'simulate', '--silent', '--json'],
        capture_output=True, text=True, cwd='C:/Projects/Caps'
    )
    elapsed = time.time() - start
    print(f'Test suite: {elapsed:.2f}s')

    # Run custom simulation
    " 2>&1

C3. Actually run the existing simulate tests:
    npx jest --testPathPattern simulate --verbose 2>&1 | tail -30

C4. Run qa_stress test:
    npx jest --testPathPattern qa_stress --verbose 2>&1 | tail -20

C5. Measure single game calculation time:
    py -3.11 << 'EOF'
    import subprocess, time, sys
    result = subprocess.run(
        ['node', '-e', '''
        const { calculateHandResultsMulti, initializeGameMulti } = require('./utils/gameLogic');
        const { DEFAULT_CONFIG } = require('./constants/gameConfig');
        const times = [];
        for (let i = 0; i < 500; i++) {
          const game = initializeGameMulti(2, DEFAULT_CONFIG);
          // Fill boards with cards
          const boards = game.boards.map(b => ({
            ...b,
            playerCards: game.playerHands[0].slice(0, 4),
            allBotCards: [game.playerHands[1].slice(0, 4)],
            openCards: game.communityCards.slice(0, 3),
            closedCards: game.communityCards.slice(3, 5),
            revealed: true,
          }));
          const t = Date.now();
          calculateHandResultsMulti(boards, 2, DEFAULT_CONFIG);
          times.push(Date.now() - t);
        }
        const avg = times.reduce((a,b)=>a+b,0)/times.length;
        const max = Math.max(...times);
        console.log(JSON.stringify({avg_ms: avg.toFixed(2), max_ms: max, total_500: times.reduce((a,b)=>a+b,0)}));
        '''],
        capture_output=True, text=True, cwd='C:/Projects/Caps'
    )
    print(result.stdout or result.stderr)
    EOF

C6. Report: avg time per game calculation, max time, estimated capacity at 500 concurrent

### STEP 4 — Graphics review
D1. Read constants/gameConfig.ts — colors
D2. Read components/Card.tsx — current card design
D3. Read components/Board.tsx — current board design  
D4. Read constants/homeThemes.ts — all 10 themes
D5. Read app/_layout.tsx + app/index.tsx — splash + home

D6. Write a GRAPHICS REVIEW report covering:
    ```markdown
    # Caps Poker — Graphics Review 2026-03-19

    ## Current Design
    - Card style: white face, black/red suits, gold border on active
    - Board style: deep red felt (#6B0000), gold borders
    - Home: dark background, gold title, 10 themes
    - Splash: dark bg, gold C + suits, fade animation

    ## Strengths
    - [list what works well]

    ## Weaknesses  
    - [list what could be improved]

    ## Alternative directions to consider
    Option A: Luxury dark (current direction, refined)
    Option B: Modern minimal (clean white/light)
    Option C: Vibrant neon (dark + bright accents)
    Option D: Classic casino (green felt, cream cards)

    ## Recommendations
    - [specific changes that would have highest impact]
    ```

D7. Save to docs/GRAPHICS-REVIEW-2026-03-19.md

### STEP 5 — Update MEMORY.md with everything
E1. Update MEMORY.md:
    - Current version + latest build number (from eas build:list)
    - Latest commit
    - All bug statuses
    - Simulation results
    - Next priorities

### STEP 6 — Report to user
F1. Print full status table
F2. Print simulation results
F3. Print graphics review summary
F4. List what STILL needs to be done

VAMOS CAPS STATUS-REFRESH — END
