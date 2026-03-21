VAMOS CAPS ORIENTATION-CHOICE v1.9.3-b100 2026-03-19-2350

## Current state: v1.9.3 build #100 | commit 3eff36a
Read MEMORY.md. Iron Rules confirmed.
IMPORTANT: Iron Rule 2 is now UNLOCKED — iOS supports BOTH portrait AND landscape.
Standing Orders: Fix autonomously. Never give user commands.

---

## GOAL
On first launch (or from Settings), user picks:
- PORTRAIT — current vertical layout
- WIDESCREEN — horizontal landscape layout

Choice is persisted. Game adapts layout accordingly.

---

## TASK A — Orientation choice screen (agent: orientation-agent)

A1. Add `orientation` field to gameStore:
    ```typescript
    type OrientationType = 'portrait' | 'landscape';
    // default: 'portrait'
    // persisted
    ```

A2. Create app/orientation-pick.tsx — shown once on first launch:
    ```tsx
    // Full screen choice:
    // Title: "CAPS POKER"
    // Subtitle: "Choose your play style"
    //
    // [PORTRAIT card]          [WIDESCREEN card]
    // 📱 vertical preview      🖥️ horizontal preview
    // "Classic"                "Pro"
    // Phone in portrait        Phone/tablet in landscape
    //
    // TAP TO SELECT → saves to store → navigates to home
    ```

A3. Show this screen only when orientation is not yet set:
    In app/_layout.tsx — after splash:
    ```typescript
    if (!orientation) {
      // show orientation picker
    } else {
      // show home
    }
    ```

---

## TASK B — Enable landscape on iOS (agent: ios-agent)

B1. Read app.json — find orientation setting
B2. Change from "portrait" to "default" (allows both):
    ```json
    "orientation": "default"
    ```
    Note: "default" allows both portrait and landscape on iOS

B3. In app/_layout.tsx — lock orientation based on user choice:
    ```typescript
    import * as ScreenOrientation from 'expo-screen-orientation';
    
    useEffect(() => {
      if (orientation === 'landscape') {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } else {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      }
    }, [orientation]);
    ```

B4. Install if needed:
    expo install expo-screen-orientation

---

## TASK C — Widescreen game layout (agent: widescreen-agent)

C1. Read app/game.tsx — understand current portrait layout
C2. Read constants/deviceBreakpoints.ts

C3. Add widescreen layout to game.tsx:
    ```typescript
    const isLandscape = useGameStore(s => s.orientation) === 'landscape' || 
                        (Platform.OS === 'web' && DEVICE.W > DEVICE.H);
    
    if (isLandscape) {
      return (
        <SafeAreaView style={styles.containerLandscape}>
          {/* LEFT PANEL — Your hand */}
          <View style={styles.leftPanel}>
            <Text>YOUR HAND</Text>
            <PlayerHand ... />
          </View>
          
          {/* CENTER — Boards in 2 columns */}
          <View style={styles.centerPanel}>
            <View style={styles.boardsGrid}>
              {/* boards in 2x2 grid */}
            </View>
          </View>
          
          {/* RIGHT PANEL — Bot hand + timer */}
          <View style={styles.rightPanel}>
            <Text>BOT</Text>
            {/* bot status */}
          </View>
        </SafeAreaView>
      );
    }
    ```

C4. Add landscape styles:
    ```typescript
    containerLandscape: { flex: 1, flexDirection: 'row' },
    leftPanel: { width: '25%', ... },
    centerPanel: { flex: 1, ... },
    rightPanel: { width: '25%', ... },
    boardsGrid: { flexDirection: 'row', flexWrap: 'wrap', ... },
    ```

C5. Apply same widescreen logic to results.tsx

C6. npx tsc --noEmit — 0 errors

---

## TASK D — Settings: orientation toggle
Agent: settings-agent

D1. Read app/settings.tsx
D2. Add ORIENTATION section at top (before BACKGROUND THEME):
    ```
    📱 ORIENTATION
    [PORTRAIT] [WIDESCREEN]
    Active: gold border
    ```
D3. On change: update store + call ScreenOrientation.lockAsync

---

## FINAL STEPS
1. expo install expo-screen-orientation (if not installed)
2. npx tsc --noEmit — 0 errors
3. npx jest --silent — all pass
4. npx expo export --platform web --clear
5. node scripts/fix-web-html.js
6. cd dist && vercel --prod --yes
7. git add -A && git commit -m "feat: portrait/landscape orientation choice on first launch [v1.9.3-b101]"
8. git push origin main
9. Update MEMORY.md — note Iron Rule 2 unlocked
10. Report done

VAMOS CAPS ORIENTATION-CHOICE — END
