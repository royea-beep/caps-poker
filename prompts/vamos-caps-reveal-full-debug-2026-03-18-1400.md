VAMOS CAPS REVEAL-FULL-DEBUG 2026-03-18-1400

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

## PROBLEM 1 — Still stuck after BOTS READY — never reaches reveal
## PROBLEM 2 — Reveal not showing one board at a time full screen

---

## TASK A — Add debug logging to trace exact stuck point

A1. Read app/game.tsx in full

A2. Add console.log at EVERY step of the ready→reveal flow:
    - When playerReady becomes true
    - When allBotsReady becomes true  
    - When the useEffect fires
    - When navigateToReveal is called
    - When router.replace('/results') is called
    - Inside the try/catch — log the error if any

A3. Read app/results.tsx in full
    Add console.log at:
    - Component mount
    - When revealData is read from store
    - When RevealSequence receives props

A4. Read store/gameStore.ts in full
    Check: is setRevealData actually being called before navigation?
    Check: does revealData persist correctly in Zustand?

A5. The real question: does router.replace('/results') actually work?
    Try changing to router.push('/results') and see if that helps
    Or try using expo-router's <Redirect> component instead

---

## TASK B — Fix reveal one-board-at-a-time

B1. Read components/RevealSequence.tsx in full
B2. Read hooks/useRevealSequence.ts in full

B3. Current problem: all boards showing at once instead of one at a time
    The fix should be:
    - Show board index `currentBoardIndex` only
    - When board is done → increment currentBoardIndex
    - When all boards done → call onComplete

B4. Make sure the reveal Modal covers the FULL screen:
    ```tsx
    <Modal
      visible={true}
      transparent={false}
      animationType="none"
      statusBarTranslucent={true}
    >
      <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
        {/* ONE board at a time */}
      </View>
    </Modal>
    ```

B5. Each board reveal shows:
    - Board title: "BOARD 1 of 4"
    - Community cards (flop visible, turn+river flip)
    - Player cards vs Bot cards
    - Winner announcement
    - "TAP TO CONTINUE" at bottom

B6. npx tsc --noEmit — 0 errors
B7. npx jest --silent — all pass

---

## TASK C — Verify navigation actually works on iOS

C1. In app/game.tsx — replace router.replace with a more defensive version:
    ```typescript
    // Try replace first, fall back to push
    try {
      router.replace('/results');
    } catch (e) {
      console.error('[NAV] replace failed:', e);
      try {
        router.push('/results');
      } catch (e2) {
        console.error('[NAV] push also failed:', e2);
      }
    }
    ```

C2. Also add a manual "CONTINUE" button that appears after 3 seconds if stuck:
    ```tsx
    {playerReady && allBotsReady && (
      <Pressable 
        style={styles.continueBtn}
        onPress={() => navigateToReveal()}
      >
        <Text>TAP TO CONTINUE</Text>
      </Pressable>
    )}
    ```
    This gives the user a fallback if auto-navigation fails

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — all pass
3. npx expo export --platform web
4. node scripts/fix-web-html.js
5. cd dist && vercel --prod --yes
6. git add -A && git commit -m "fix: reveal stuck + one board at a time full screen"
7. git push origin main
8. Report what the debug logs reveal about where it gets stuck

VAMOS CAPS REVEAL-FULL-DEBUG — END
