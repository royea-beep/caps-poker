VAMOS CAPS HOME-REDESIGN-THEMES 2026-03-18-1800

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## TASK A — Multiple home screen themes (switchable in Settings)
Agent: theme-designer

A1. Read app/index.tsx, constants/theme.ts, store/gameStore.ts in full

A2. Add a new store field: homeTheme (default: 'dark_gold')
    Options: 'dark_gold' | 'navy_silver' | 'purple_neon' | 'casino_red'

A3. Define 4 home themes in constants/homeThemes.ts:
    ```typescript
    export const HOME_THEMES = {
      dark_gold: {
        bg: '#0a0a0a',
        bgGradient: ['#0a0a0a', '#1a1200'],
        accent: '#c9a84c',
        accentSecondary: '#8B6914',
        buttonPrimary: '#c9a84c',
        buttonPrimaryText: '#000000',
        buttonSecondaryBg: 'rgba(201,168,76,0.08)',
        buttonSecondaryBorder: '#c9a84c',
        buttonSecondaryText: '#c9a84c',
        titleColor: '#c9a84c',
        subtitleColor: 'rgba(201,168,76,0.6)',
      },
      navy_silver: {
        bg: '#0a0f1e',
        bgGradient: ['#0a0f1e', '#0d1530'],
        accent: '#7eb8e8',
        accentSecondary: '#4a90c4',
        buttonPrimary: '#7eb8e8',
        buttonPrimaryText: '#0a0f1e',
        buttonSecondaryBg: 'rgba(126,184,232,0.08)',
        buttonSecondaryBorder: '#7eb8e8',
        buttonSecondaryText: '#7eb8e8',
        titleColor: '#ffffff',
        subtitleColor: 'rgba(255,255,255,0.5)',
      },
      purple_neon: {
        bg: '#080010',
        bgGradient: ['#080010', '#130020'],
        accent: '#b44fff',
        accentSecondary: '#7c1fe0',
        buttonPrimary: '#b44fff',
        buttonPrimaryText: '#ffffff',
        buttonSecondaryBg: 'rgba(180,79,255,0.08)',
        buttonSecondaryBorder: '#b44fff',
        buttonSecondaryText: '#b44fff',
        titleColor: '#b44fff',
        subtitleColor: 'rgba(180,79,255,0.6)',
      },
      casino_red: {
        bg: '#0a0000',
        bgGradient: ['#0a0000', '#1a0000'],
        accent: '#e8192c',
        accentSecondary: '#a00000',
        buttonPrimary: '#e8192c',
        buttonPrimaryText: '#ffffff',
        buttonSecondaryBg: 'rgba(232,25,44,0.08)',
        buttonSecondaryBorder: '#e8192c',
        buttonSecondaryText: '#e8192c',
        titleColor: '#ffffff',
        subtitleColor: 'rgba(255,255,255,0.5)',
      },
    };
    ```

A4. Redesign app/index.tsx using the selected theme:
    - Background: use bgGradient (LinearGradient if available, else solid bg)
    - CAPS title: large, bold, titleColor
    - Subtitle: new tagline "Outsmart the Board. Win Every Round." in subtitleColor
    - NEW HAND button: buttonPrimary bg, buttonPrimaryText color, large, floating shadow
    - Other buttons: glassmorphism style with buttonSecondaryBg + buttonSecondaryBorder
    - All buttons: borderRadius 16, shadow underneath for floating effect
    - Stats box: semi-transparent dark background

A5. Button floating effect (all buttons):
    iOS shadow: shadowColor accent, shadowOffset {0,4}, shadowOpacity 0.4, shadowRadius 12
    Web: boxShadow `0 4px 20px ${accent}40`

A6. Fix logo size — CAPS text too big:
    fontSize: 64 (was too large), adjust so subtitle is visible without scrolling

A7. Fix BugReporter icon — move to absolute bottom-right corner, not overlapping content:
    position: 'absolute', bottom: 80, right: 16

A8. Add theme selector in Settings screen:
    Section: "HOME THEME"
    Show 4 color swatches, tap to switch theme
    Active theme: gold border around swatch

A9. npx tsc --noEmit — 0 errors

---

## TASK B — Google Sign-In with Supabase
Agent: auth-agent

B1. Check if expo-auth-session and @react-native-google-signin/google-signin are installed:
    cat package.json | grep -E "google|auth-session|supabase"

B2. Implement Google Sign-In using Supabase Auth:
    - Use supabase.auth.signInWithOAuth({ provider: 'google' }) on web
    - Use expo-auth-session for native
    
B3. Create utils/auth.ts:
    ```typescript
    import { supabase } from './supabase';
    import * as WebBrowser from 'expo-web-browser';
    import * as AuthSession from 'expo-auth-session';
    
    WebBrowser.maybeCompleteAuthSession();
    
    export async function signInWithGoogle() {
      if (Platform.OS === 'web') {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: 'https://caps.ftable.co.il' }
        });
        return { error };
      }
      // Native: use expo-auth-session
      const redirectUrl = AuthSession.makeRedirectUri({ useProxy: true });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUrl, skipBrowserRedirect: true }
      });
      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        if (result.type === 'success') {
          const url = new URL(result.url);
          const accessToken = url.searchParams.get('access_token');
          const refreshToken = url.searchParams.get('refresh_token');
          if (accessToken) {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken ?? '' });
          }
        }
      }
      return { error };
    }
    
    export async function signOut() {
      await supabase.auth.signOut();
    }
    
    export function useAuthUser() {
      const [user, setUser] = useState(null);
      useEffect(() => {
        supabase.auth.getUser().then(({ data }) => setUser(data.user));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
          setUser(session?.user ?? null);
        });
        return () => subscription.unsubscribe();
      }, []);
      return user;
    }
    ```

B4. Add Google Sign-In button to index.tsx home screen:
    - Show "Sign in with Google" button if not logged in
    - Show user avatar + name if logged in
    - On sign in → sync chips to Supabase leaderboard

B5. Create Supabase table for user profiles:
    ```sql
    CREATE TABLE IF NOT EXISTS user_profiles (
      id uuid REFERENCES auth.users PRIMARY KEY,
      display_name text,
      avatar_url text,
      chips integer DEFAULT 500,
      total_played integer DEFAULT 0,
      total_won integer DEFAULT 0,
      best_win integer DEFAULT 0,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    ```
    Run this SQL via Supabase API or note it for manual execution.

B6. On sign in — sync local chips to Supabase
B7. On chip change — update Supabase profile (debounced, fire-and-forget)

B8. npx tsc --noEmit — 0 errors

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — all pass
3. npx expo export --platform web
4. node scripts/fix-web-html.js
5. cd dist && vercel --prod --yes
6. git add -A && git commit -m "feat: 4 home themes switchable in settings, Google sign-in"
7. git push origin main
8. Update MEMORY.md
9. Report done

VAMOS CAPS HOME-REDESIGN-THEMES — END
