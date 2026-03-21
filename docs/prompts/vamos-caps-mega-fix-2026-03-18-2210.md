VAMOS CAPS MEGA-FIX 2026-03-18-2210

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## TASK A — Bot cards always visible + optimal card badge
Agent: reveal-agent

A1. Read components/RevealSequence.tsx in full

A2. Bot cards: always faceDown={false} from the first frame — no flip, always visible

A3. Win probability: show from the very start next to each player label
    Calculate initial probability immediately when board mounts (based on open flop cards)
    "BOT 36%" and "YOU 64%" visible before any countdown

A4. Optimal card badge — small card shape (NOT text):
    - Width: 28px, Height: 40px, white bg, borderRadius 4, thin border
    - Rank fontSize 12 fontWeight '900', Suit fontSize 10
    - Red/black based on suit
    - Small label above: "BEST" in gold 8px
    - Position: to the right of each player's card row
    - Show for BOTH players after flop is revealed
    - Update after turn
    - Calculate: what single card from remaining deck gives best hand improvement
      (flush draw → completing card, straight draw → completing card, else highest pair card)

A5. npx tsc --noEmit — 0 errors

---

## TASK B — Fix Google OAuth iOS redirect (localhost bug)
Agent: auth-agent

B1. Read utils/auth.ts in full
B2. Read app.json — find scheme field

B3. Fix native redirect URI:
    ```typescript
    import * as Linking from 'expo-linking';
    
    const redirectUrl = Platform.OS === 'web'
      ? 'https://caps.ftable.co.il'
      : Linking.createURL('auth/callback');
    ```

B4. Make sure app.json has scheme:
    "scheme": "caps-poker"
    If missing — add it

B5. Add deep link handler in app/_layout.tsx:
    ```typescript
    useEffect(() => {
      const handleDeepLink = async (url: string) => {
        if (url.includes('access_token') || url.includes('code=')) {
          await supabase.auth.exchangeCodeForSession(url);
        }
      };
      Linking.getInitialURL().then(url => { if (url) handleDeepLink(url); });
      const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
      return () => sub.remove();
    }, []);
    ```

B6. npx tsc --noEmit — 0 errors

---

## TASK C — Home screen: fix title size for all devices
Agent: home-agent

C1. Read app/index.tsx in full

C2. Title must fit ONE LINE on ALL devices (iPhone SE = 375px wide):
    Use useWindowDimensions to calculate:
    ```typescript
    const titleFontSize = Math.min(42, Math.floor(screenW * 0.105));
    // iPhone SE (375px): 375 * 0.105 = 39px ← fits
    // iPhone 14 (390px): 390 * 0.105 = 40px ← fits  
    // iPhone 14 Pro Max (430px): 430 * 0.105 = 45px → capped at 42
    ```

C3. Remove letterSpacing from title (causes width issues):
    letterSpacing: 2 max

C4. Suit symbols row — make sure it fits:
    fontSize: 14, letterSpacing: 8

C5. Tagline — single line, centered:
    fontSize: 11, numberOfLines: 1, adjustsFontSizeToFit: true

C6. Stats box — more compact:
    paddingVertical: 8 (was 12)
    Each stat value: fontSize 18 (was 22)

C7. All buttons — slightly smaller:
    btnHeight = Math.min(46, screenH * 0.06)
    btnFontSize = Math.min(14, screenH * 0.019)

C8. npx tsc --noEmit — 0 errors

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — all pass
3. npx expo export --platform web --clear
4. node scripts/fix-web-html.js
5. cd dist && vercel --prod --yes
6. git add -A && git commit -m "feat: bot visible in reveal, optimal badge, iOS auth fix, home responsive"
7. git push origin main
8. Update MEMORY.md
9. Report done with summary of each task

VAMOS CAPS MEGA-FIX — END
