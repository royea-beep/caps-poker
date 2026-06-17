# VAMOS CAPS CAPS-AUTH-INFRASTRUCTURE
**Date:** 2026-04-23 IST

---

## Anonymous Auth + Google Login Prompt (after game 3-5)

### GAME RULES REMINDER:
- 2P=4 boards, 3P=3 boards, 4P=2 boards. 4 cards PER BOARD. 52-card deck.

### WHAT'S ALREADY DONE (in Supabase DB):
- All 17 player tables now have BOTH device_id AND user_id columns
- `merge_guest_to_user(p_device_id, p_user_id)` RPC exists and merges all tables
- Google OAuth already works (GCP project 9Soccer-Mascots, client 133353581092)
- 2 existing Google auth users (Roye, Avi)

### WHAT THIS VAMOS BUILDS:
1. Supabase client with AsyncStorage session persistence
2. Anonymous auth on first app open (silent, invisible)
3. Auth state management (utils/auth.ts)
4. Login prompt modal after game 3-5
5. Google OAuth flow with linkIdentity() merge
6. Feature gates: Friends tab requires login

---

## TASK 1 — Update Supabase client for auth persistence

Open `utils/supabase.ts` (32 lines). The current client has NO auth storage config.

Update the createClient call to persist sessions:

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ... existing FALLBACK_URL, FALLBACK_KEY, Constants loading ...

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // important for React Native
      },
    });
  }
  return _client;
}
```

Check if `@react-native-async-storage/async-storage` is already installed:
```bash
grep "async-storage" package.json
```
If not installed: `npm install @react-native-async-storage/async-storage`

---

## TASK 2 — Create auth utility (utils/auth.ts)

Create `utils/auth.ts`:

```typescript
import { getSupabase } from './supabase';
import { getDeviceId } from './leaderboard';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_STATE_KEY = 'caps_auth_state';

export type AuthState = {
  isAnonymous: boolean;
  userId: string | null;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
};

// Get current auth state
export async function getAuthState(): Promise<AuthState> {
  const sb = getSupabase();
  if (!sb) return { isAnonymous: true, userId: null, displayName: null, email: null, avatarUrl: null };

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { isAnonymous: true, userId: null, displayName: null, email: null, avatarUrl: null };

  const isAnon = user.is_anonymous === true;
  return {
    isAnonymous: isAnon,
    userId: user.id,
    displayName: isAnon ? null : (user.user_metadata?.full_name || user.user_metadata?.name || null),
    email: isAnon ? null : (user.email || null),
    avatarUrl: isAnon ? null : (user.user_metadata?.avatar_url || null),
  };
}

// Silent anonymous sign-in on first open
export async function ensureAnonymousAuth(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    // Check if already signed in
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) return session.user.id;

    // Create anonymous user
    const { data, error } = await sb.auth.signInAnonymously();
    if (error) {
      console.warn('[auth] Anonymous sign-in failed:', error.message);
      return null;
    }
    return data.user?.id || null;
  } catch (e) {
    console.warn('[auth] ensureAnonymousAuth error:', e);
    return null;
  }
}

// Google OAuth login (upgrades anonymous to permanent)
export async function loginWithGoogle(): Promise<{ success: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { success: false, error: 'Supabase not configured' };

  try {
    const deviceId = await getDeviceId();
    const redirectUrl = Linking.createURL('auth-callback');

    if (Platform.OS === 'web') {
      // Web: redirect-based
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) return { success: false, error: error.message };
      return { success: true };
    }

    // Native: open browser for OAuth
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
    });
    if (error || !data.url) return { success: false, error: error?.message || 'No URL' };

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
    if (result.type !== 'success') return { success: false, error: 'Cancelled' };

    // Extract tokens from URL
    const url = result.url;
    const params = new URL(url);
    const accessToken = params.searchParams.get('access_token') || 
      url.split('#')[1]?.split('&').find(p => p.startsWith('access_token='))?.split('=')[1];
    const refreshToken = params.searchParams.get('refresh_token') ||
      url.split('#')[1]?.split('&').find(p => p.startsWith('refresh_token='))?.split('=')[1];

    if (accessToken && refreshToken) {
      await sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    }

    // Merge device data to the new user
    const { data: { user } } = await sb.auth.getUser();
    if (user && deviceId) {
      await sb.rpc('merge_guest_to_user', { p_device_id: deviceId, p_user_id: user.id });
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || 'Unknown error' };
  }
}

// Check if should prompt login (after game 3-5)
export async function shouldPromptLogin(): Promise<boolean> {
  try {
    const authState = await getAuthState();
    if (!authState.isAnonymous) return false; // Already logged in

    const dismissed = await AsyncStorage.getItem('caps_login_dismissed');
    if (dismissed) {
      // Don't prompt again for 3 days after dismiss
      const dismissedAt = parseInt(dismissed);
      if (Date.now() - dismissedAt < 3 * 24 * 60 * 60 * 1000) return false;
    }

    const gamesPlayed = await AsyncStorage.getItem('caps_total_games');
    const count = parseInt(gamesPlayed || '0');
    return count >= 3 && count <= 20; // Prompt between game 3 and 20
  } catch { return false; }
}

export async function dismissLoginPrompt(): Promise<void> {
  await AsyncStorage.setItem('caps_login_dismissed', Date.now().toString());
}

// Logout
export async function logout(): Promise<void> {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
}
```

Check if these packages are installed:
```bash
grep "expo-web-browser\|expo-linking" package.json
```
If not: `npx expo install expo-web-browser expo-linking`

---

## TASK 3 — Initialize anonymous auth on app start

In `app/_layout.tsx`, find the root useEffect and add:

```typescript
import { ensureAnonymousAuth } from '../utils/auth';

// Inside useEffect on mount (add alongside existing initAnalytics):
ensureAnonymousAuth();
```

This is fire-and-forget. If it fails, the app works exactly as before with device_id.

---

## TASK 4 — Login prompt modal component

Create `components/LoginPromptModal.tsx`:

```typescript
import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Image, Platform } from 'react-native';
import { loginWithGoogle, dismissLoginPrompt } from '../utils/auth';
import { track } from '../utils/analytics';

interface Props {
  visible: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export default function LoginPromptModal({ visible, onClose, onLoginSuccess }: Props) {
  const handleGoogle = async () => {
    track('login_google_pressed', {}, 'login_prompt');
    const result = await loginWithGoogle();
    if (result.success) {
      track('login_google_success', {}, 'login_prompt');
      onLoginSuccess();
    } else {
      track('login_google_failed', { error: result.error }, 'login_prompt');
    }
  };

  const handleDismiss = async () => {
    track('login_dismissed', {}, 'login_prompt');
    await dismissLoginPrompt();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>שמור את ההתקדמות שלך</Text>
          <Text style={styles.subtitle}>
            התחבר עם Google כדי לשמור את הצ'יפים, הרצף והכוסות שלך לנצח
          </Text>

          <Pressable style={styles.googleBtn} onPress={handleGoogle}>
            <Text style={styles.googleText}>התחבר עם Google</Text>
          </Pressable>

          <Pressable style={styles.laterBtn} onPress={handleDismiss}>
            <Text style={styles.laterText}>אולי אחר כך</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,5,5,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1a1014',
    borderRadius: 16,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#c9a84c',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  googleBtn: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  googleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  laterBtn: {
    paddingVertical: 10,
  },
  laterText: {
    fontSize: 14,
    color: '#666',
  },
});
```

---

## TASK 5 — Show login prompt after game 3-5

In `app/results.tsx`, after results are shown and hand is recorded:

```typescript
import { shouldPromptLogin } from '../utils/auth';
import LoginPromptModal from '../components/LoginPromptModal';

// State:
const [showLoginPrompt, setShowLoginPrompt] = useState(false);

// After hand is completed (in the results useEffect, after recording hand):
const totalGames = parseInt(await AsyncStorage.getItem('caps_total_games') || '0') + 1;
await AsyncStorage.setItem('caps_total_games', totalGames.toString());

if (await shouldPromptLogin()) {
  setShowLoginPrompt(true);
}

// In JSX, before closing:
<LoginPromptModal
  visible={showLoginPrompt}
  onClose={() => setShowLoginPrompt(false)}
  onLoginSuccess={() => {
    setShowLoginPrompt(false);
    // Optionally refresh user data
  }}
/>
```

---

## TASK 6 — Update all RPC calls to pass user_id

Find everywhere `getDeviceId()` is used for Supabase calls. Add user_id alongside:

```typescript
// Pattern — in utils/analytics.ts, utils/auth.ts, or wherever RPCs are called:
import { getAuthState } from './auth';

// When calling any Supabase RPC that writes data:
const authState = await getAuthState();
const deviceId = await getDeviceId();

// Pass both:
supabase.rpc('some_rpc', {
  p_device_id: deviceId,
  p_user_id: authState.userId, // null for anonymous, UUID for logged in
  // ... other params
});
```

The most critical RPCs to update:
- `record_hand_result` (results.tsx)
- `claim_daily_streak` (index.tsx)
- `track_event` (analytics.ts) — already has both columns
- `earn_chips` / `spend_chips`
- `save_hand` (results.tsx)

For each: check current call signature, add p_user_id if the RPC accepts it.

---

## TASK 7 — Supabase Dashboard: Enable Anonymous Sign-in

**MANUAL STEP FOR ROYE:**
Go to Supabase Dashboard → Authentication → Providers → Anonymous Sign-Ins → Enable

If this is not enabled, `signInAnonymously()` will fail silently.

Alternatively, check via API:
```bash
# In Supabase Dashboard: Settings > Authentication > User Sign-ups
# Make sure "Allow anonymous sign-ins" is ON
```

---

## DEPLOY
```bash
npx tsc --noEmit 2>&1 | tail -5
npx jest --forceExit 2>&1 | tail -5
npm run ota -- --message "feat: Anonymous auth + Google login prompt after game 3"
git add -A && git commit -m "feat: Auth infrastructure — anonymous auth, Google login prompt, merge pipeline"
git push origin main
```

---

## AFTER AUDIT
```
utils/auth.ts created:                      YES/NO
ensureAnonymousAuth on app start:            YES/NO
LoginPromptModal component created:          YES/NO
Login prompt shown after game 3-5:           YES/NO
Google OAuth flow works:                     YES/NO
merge_guest_to_user called after login:      YES/NO
caps_total_games counter incrementing:       YES/NO
Login dismiss = 3 day cooldown:              YES/NO
analytics: login_google_pressed tracked:     YES/NO
expo-web-browser installed:                  YES/NO
Tests passing:                               [N]/[N]
OTA deployed:                                [hash]
```

Yes, allow all edits.
VAMOS CAPS CAPS-AUTH-INFRASTRUCTURE — END
