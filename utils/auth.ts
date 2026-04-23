import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { getSupabase } from './supabase';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { getDeviceId } from './leaderboard';

export type AuthState = {
  isAnonymous: boolean;
  userId: string | null;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
};

export async function getAuthState(): Promise<AuthState> {
  const sb = getSupabase();
  if (!sb) return { isAnonymous: true, userId: null, displayName: null, email: null, avatarUrl: null };
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return { isAnonymous: true, userId: null, displayName: null, email: null, avatarUrl: null };
    const isAnon = user.is_anonymous === true;
    return {
      isAnonymous: isAnon,
      userId: user.id,
      displayName: isAnon ? null : (user.user_metadata?.full_name ?? user.user_metadata?.name ?? null),
      email: isAnon ? null : (user.email ?? null),
      avatarUrl: isAnon ? null : (user.user_metadata?.avatar_url ?? null),
    };
  } catch {
    return { isAnonymous: true, userId: null, displayName: null, email: null, avatarUrl: null };
  }
}

export async function ensureAnonymousAuth(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) return session.user.id;
    const { data, error } = await sb.auth.signInAnonymously();
    if (error) return null;
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function loginWithGoogle(): Promise<{ success: boolean; error?: string }> {
  const deviceId = await getDeviceId();
  const { error } = await signInWithGoogle();
  if (error) return { success: false, error: error.message };

  // Merge guest device data into the authenticated user
  const sb = getSupabase();
  if (sb && deviceId) {
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (user) {
        await sb.rpc('merge_guest_to_user', { p_device_id: deviceId, p_user_id: user.id });
      }
    } catch {}
  }
  return { success: true };
}

export async function shouldPromptLogin(): Promise<boolean> {
  try {
    const authState = await getAuthState();
    if (!authState.isAnonymous) return false;

    const dismissed = await AsyncStorage.getItem('caps_login_dismissed');
    if (dismissed) {
      if (Date.now() - parseInt(dismissed, 10) < 3 * 24 * 60 * 60 * 1000) return false;
    }

    const gamesPlayed = await AsyncStorage.getItem('caps_total_games');
    const count = parseInt(gamesPlayed ?? '0', 10);
    return count >= 3 && count <= 20;
  } catch {
    return false;
  }
}

export async function dismissLoginPrompt(): Promise<void> {
  await AsyncStorage.setItem('caps_login_dismissed', Date.now().toString());
}

export async function logout(): Promise<void> {
  await signOut();
}

WebBrowser.maybeCompleteAuthSession();

export async function signInWithGoogle(): Promise<{ error: Error | null }> {
  const client = getSupabase();
  if (!client) return { error: new Error('Supabase not configured') };

  const redirectUrl = Platform.OS === 'web'
    ? 'https://caps.ftable.co.il'
    : Linking.createURL('auth/callback');

  if (Platform.OS === 'web') {
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl },
    });
    return { error: error as Error | null };
  }

  // Native: open browser with skipBrowserRedirect so we can capture the result
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
  });

  if (data?.url) {
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
    if (result.type === 'success') {
      // PKCE: exchange code for session
      const { error: exchError } = await client.auth.exchangeCodeForSession(result.url);
      if (exchError) {
        // Fallback: implicit flow — tokens in hash fragment
        const normalized = result.url.replace('#', '?');
        try {
          const params = new URL(normalized).searchParams;
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          if (accessToken) {
            await client.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken ?? '',
            });
          }
        } catch {}
      }
    }
  }

  return { error: error as Error | null };
}

export async function signOut(): Promise<void> {
  const client = getSupabase();
  if (client) await client.auth.signOut();
}

export function useAuthUser(): User | null {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const client = getSupabase();
    if (!client) return;

    client.auth.getUser().then(({ data }: { data: { user: User | null } }) =>
      setUser(data.user ?? null)
    );

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return user;
}
