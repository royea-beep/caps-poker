import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { getSupabase } from './supabase';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';

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
