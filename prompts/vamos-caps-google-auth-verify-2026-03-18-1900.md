VAMOS CAPS GOOGLE-AUTH-VERIFY 2026-03-18-1900

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## SITUATION
Google OAuth was configured in Supabase + Google Cloud Console.
But the Sign in with Google button is not visible on the home screen.
Need to find it, fix it, and verify it works.

## TASK A — Find why Google sign-in button is missing

A1. Read app/index.tsx in full
A2. Find where the Google sign-in button should be rendered
A3. Check utils/auth.ts in full — is signInWithGoogle implemented correctly?
A4. Check if expo-auth-session is actually installed:
    cat package.json | grep -E "auth-session|web-browser"
A5. Check if the button is hidden due to a condition:
    - Is it only showing when user is NOT logged in?
    - Is there a Platform.OS check hiding it?
    - Is there an error being swallowed?

## TASK B — Fix and make Google sign-in visible and working

B1. Make sure the Google sign-in button is ALWAYS visible on home screen when user is not logged in
B2. Style it properly:
    ```tsx
    <Pressable
      style={styles.googleBtn}
      onPress={handleGoogleSignIn}
    >
      <Text style={styles.googleBtnText}>🔵 Sign in with Google</Text>
    </Pressable>
    ```
    Style: white background, dark text, borderRadius 12, padding 14, full width

B3. Add loading state — show "Signing in..." while auth is in progress

B4. Add error handling — if sign-in fails, show error message

B5. After sign-in success:
    - Save user display name to store
    - Show user name + avatar on home screen
    - Show "Sign out" option

B6. Test on web — verify Supabase OAuth redirect works:
    curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/auth/v1/settings" | python3 -c "import json,sys; d=json.load(sys.stdin); print('Google enabled:', d.get('external', {}).get('google', False))"

## TASK C — Verify full auth flow

C1. Check Supabase auth config:
    curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/auth/v1/settings" \
      -H "apikey: $(grep EXPO_PUBLIC_SUPABASE_ANON_KEY C:/Projects/Caps/.env | cut -d= -f2)"

C2. Verify user_profiles table exists and has RLS:
    curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/user_profiles?limit=1" \
      -H "apikey: $(grep EXPO_PUBLIC_SUPABASE_ANON_KEY C:/Projects/Caps/.env | cut -d= -f2)" \
      -H "Authorization: Bearer $(grep EXPO_PUBLIC_SUPABASE_ANON_KEY C:/Projects/Caps/.env | cut -d= -f2)"

C3. Report Google enabled: true/false

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — all pass
3. npx expo export --platform web
4. node scripts/fix-web-html.js
5. cd dist && vercel --prod --yes
6. git add -A && git commit -m "fix: Google sign-in button visible, auth flow complete"
7. git push origin main
8. Report exactly where the button is and how to use it

VAMOS CAPS GOOGLE-AUTH-VERIFY — END
