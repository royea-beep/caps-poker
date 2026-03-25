VAMOS CAPS AUTH-UI-FIX 2026-03-18-2000

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## PROBLEM 1 — Google sign-in on iOS redirects to localhost
## PROBLEM 2 — Home screen still too large, buttons not professional/floating

---

## TASK A — Fix Google OAuth redirect on iOS
Agent: auth-fixer

A1. Read utils/auth.ts in full

A2. The problem: makeRedirectUri is returning localhost instead of the app's deep link URI
    Fix for native:
    ```typescript
    import * as Linking from 'expo-linking';
    
    // For native, use the app's deep link scheme
    const redirectUrl = Platform.OS === 'web'
      ? 'https://caps.ftable.co.il'
      : Linking.createURL('/');
    ```

A3. Also add the correct redirect URI to app.json scheme:
    Check app.json for "scheme" field — should be "caps-poker" or similar
    cat app.json | grep scheme

A4. Make sure app.json has:
    ```json
    "scheme": "caps-poker"
    ```

A5. The Supabase callback needs to handle the deep link — add to app/_layout.tsx:
    ```typescript
    useEffect(() => {
      // Handle OAuth deep link callback
      const handleUrl = async (url: string) => {
        if (url.includes('access_token') || url.includes('code=')) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(url);
          if (data.session) console.log('[AUTH] session established');
        }
      };
      
      Linking.getInitialURL().then(url => { if (url) handleUrl(url); });
      const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
      return () => sub.remove();
    }, []);
    ```

A6. npx tsc --noEmit — 0 errors

---

## TASK B — Professional floating buttons + responsive home screen
Agent: ui-designer

B1. Read app/index.tsx and constants/homeThemes.ts in full

B2. The home screen needs to look like a PREMIUM 2026 app.
    Reference: modern poker apps, premium mobile games.

B3. Fix sizing — everything must fit on screen without scrolling on iPhone 14:
    - CAPS POKER title: fontSize 44, NOT 52
    - Subtitle: fontSize 13
    - Stats box: compact, padding 10
    - Buttons: height 50px max
    - Gap between buttons: 8px
    - Use ScrollView with contentContainerStyle to prevent overflow

B4. Professional floating button design:
    Each button must look like it's FLOATING off the screen:
    ```typescript
    // Primary button (NEW HAND)
    shadow: {
      shadowColor: theme.accent,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.45,
      shadowRadius: 16,
      elevation: 12,
    }
    // Web equivalent
    boxShadow: `0 8px 32px ${theme.accent}55, 0 2px 8px rgba(0,0,0,0.4)`
    
    // Secondary buttons
    shadow: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    }
    ```

B5. Button press animation — scale down slightly when pressed:
    Use Pressable with onPressIn/onPressOut to scale 1.0 → 0.96

B6. Add subtle inner highlight on primary button (top edge lighter):
    ```typescript
    // Overlay view inside button
    <View style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      height: '50%',
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderRadius: 14,
    }} />
    ```

B7. Google sign-in button style — make it look official:
    White background, Google blue dot → replace with actual Google colors:
    ```
    backgroundColor: '#ffffff'
    border: none
    Text: "Continue with Google" in dark gray #1f1f1f
    Left: Google G logo (use emoji 🔵 or a colored circle with G)
    ```

B8. npx tsc --noEmit — 0 errors

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — all pass
3. npx expo export --platform web
4. node scripts/fix-web-html.js
5. cd dist && vercel --prod --yes
6. git add -A && git commit -m "fix: Google OAuth iOS redirect, premium floating buttons"
7. git push origin main
8. Report done

VAMOS CAPS AUTH-UI-FIX — END
