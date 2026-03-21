VAMOS CAPS MEGA-BUG-FIX v1.9.3-b93 2026-03-19-1800

## Current state: v1.9.3 build #93 | commit b26bb47
Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## BUGS FROM AUDIO + SCREENSHOTS — FIX ALL IN PARALLEL

---

## TASK A — Splash screen (agent: splash-agent)

### Problem
App jumps to home screen in ~0.5 seconds — no identity, no branding.
User feedback: "CAPS POKER splash missing — should show at least 3 seconds"

### Fix
A1. Read app/_layout.tsx in full
A2. Read app/index.tsx — find how home screen loads

A3. Create app/splash.tsx — a proper splash screen:
    ```tsx
    import React, { useEffect } from 'react';
    import { View, Text, StyleSheet } from 'react-native';
    import Animated, { useSharedValue, withTiming, withSequence, withDelay, runOnJS } from 'react-native-reanimated';
    import { useRouter } from 'expo-router';

    export default function SplashScreen() {
      const router = useRouter();
      const opacity = useSharedValue(0);
      const scale = useSharedValue(0.85);

      useEffect(() => {
        // Fade in + scale up over 600ms
        opacity.value = withTiming(1, { duration: 600 });
        scale.value = withTiming(1, { duration: 600 });
        
        // After 3.5s total — fade out and navigate
        opacity.value = withSequence(
          withTiming(1, { duration: 600 }),
          withDelay(2500, withTiming(0, { duration: 400 }))
        );
        
        // Navigate after 3.5s
        const timer = setTimeout(() => {
          router.replace('/(tabs)' as any) // adjust to actual home route
        }, 3500);
        
        return () => clearTimeout(timer);
      }, []);

      const animStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
      }));

      return (
        <View style={styles.container}>
          <Animated.View style={[styles.content, animStyle]}>
            <Text style={styles.logo}>♠ ♥</Text>
            <Text style={styles.title}>CAPS POKER</Text>
            <Text style={styles.subtitle}>4 Boards. One Winner.</Text>
            <View style={styles.divider} />
            <View style={styles.suits}>
              <Text style={styles.suit}>♣</Text>
              <Text style={styles.suit}>♦</Text>
            </View>
          </Animated.View>
        </View>
      );
    }

    const styles = StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: '#0a0a0a',
        alignItems: 'center',
        justifyContent: 'center',
      },
      content: { alignItems: 'center' },
      logo: { fontSize: 48, color: '#c9a84c', letterSpacing: 8, marginBottom: 16 },
      title: { fontSize: 42, fontWeight: '900', color: '#c9a84c', letterSpacing: 6 },
      subtitle: { fontSize: 16, color: '#888', letterSpacing: 3, marginTop: 8 },
      divider: { width: 60, height: 2, backgroundColor: '#c9a84c', marginVertical: 24, opacity: 0.5 },
      suits: { flexDirection: 'row', gap: 24 },
      suit: { fontSize: 32, color: '#c9a84c', opacity: 0.6 },
    });
    ```

A4. Check current routing in app/_layout.tsx:
    - If using expo-router: set initialRouteName to splash or add redirect logic
    - If using SplashScreen from expo-splash-screen: keep it visible until splash animation done
    
A5. Integrate with expo-splash-screen properly:
    - In _layout.tsx: call SplashScreen.preventAutoHideAsync() on mount
    - Hide it only after fonts/assets loaded
    - Then show our custom splash for 3.5s

A6. npx tsc --noEmit — 0 errors

---

## TASK B — 8-second delay after both players ready (agent: timing-agent)

### Problem
After both bot and player finish placing cards → 8 second wait before boards start revealing.
User feedback: "After both ready, takes 8 seconds to start. Should be max 2 seconds."

### Fix
B1. Read app/game.tsx — find the timer/delay after playerReady + allBotsReady
B2. Find the fallback timer or countdown that causes 8s delay
B3. Read the useEffect that triggers navigateToReveal

B4. The issue is likely:
    - A 3s countdown that fires even when both are ready
    - Or a fallback timer set to 8000ms
    - Find: setTimeout(..., 8000) or similar

B5. Fix:
    - When BOTH player and bot are ready → navigate immediately (or after max 1.5s)
    - Remove any unnecessary countdown when both sides are done
    - Keep the 3s countdown only when player is NOT ready yet (time pressure)

B6. npx tsc --noEmit — 0 errors

---

## TASK C — Card placement area cut off on iPhone 16 (agent: layout-agent)

### Problem
On iPhone 16, only half the card placement area is visible.
User feedback: "Cards resolution still bad, half the space to place cards"
Also: "The placement area looks small — barely fits the cards"

### Fix
C1. Read app/game.tsx — find board layout, BOARD_CARD_H, board container sizes
C2. Read components/Board.tsx — find card slot rendering
C3. Read constants/deviceBreakpoints.ts — check rv() values

C4. The issue: board height is calculated wrong for larger phones.
    On iPhone 16 (430px wide, 932px tall) the board section is too short.

C5. Fix board container to use flex properly:
    - Board section: flex: 1 (not fixed height)
    - Each board: flex: 1/numberOfBoards
    - Card slots: aspect ratio based, not fixed height
    - Use useWindowDimensions() for ALL size calculations

C6. Fix card slot empty spaces (dashed boxes):
    - Must be same size as actual cards
    - Calculate from available space, not hardcoded

C7. Check SafeAreaView usage — ensure bottom area not clipped

C8. npx tsc --noEmit — 0 errors

---

## TASK D — Home screen layout: buttons vertical not horizontal (agent: home-agent)

### Problem
LEADERBOARD / HAND HISTORY / SETTINGS buttons overflow or misalign.
User feedback: "Buttons at bottom not in balanced layout, settings cut off"

### Fix
D1. Read app/index.tsx — find the bottom button row (LEADERBOARD | HAND HISTORY | SETTINGS)
D2. Make the row properly centered with equal spacing
D3. Use flexDirection: 'row', justifyContent: 'center', gap
D4. Ensure all 3 labels fit on one line on all screen sizes
D5. adjustsFontSizeToFit on each label
D6. npx tsc --noEmit — 0 errors

---

## TASK E — BEST card hint below each player (agent: hint-agent)

### Problem
User feedback: "Add something below each player showing what move they didn't make that was optimal"
Show the best card they COULD have played but didn't, as a subtle hint after reveal.

### Fix
E1. Read components/RevealSequence.tsx — find playerOptimalHint and botOptimalHint
E2. After allRevealed = true, show a small text below each hand:
    "Best play: [card rank][suit]" in gold color, small font (10px)
E3. Only show if the optimal card was NOT already played (i.e., it's still in hand)
E4. npx tsc --noEmit — 0 errors

---

## FINAL STEPS (all agents sync here)
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — 115/115
3. npx expo export --platform web --clear
4. node scripts/fix-web-html.js
5. cd dist && vercel --prod --yes
6. git add -A && git commit -m "fix: splash screen 3.5s, 8s delay removed, board layout iPhone 16, home buttons, best card hint [v1.9.3-b94]"
7. git push origin main
8. Update MEMORY.md: add all fixes
9. Report table: bug → root cause → fix → files changed

VAMOS CAPS MEGA-BUG-FIX — END
