import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { getSupabase } from './supabase';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';

WebBrowser.maybeCompleteAuthSession();

export async function signInWithGoogle(): Promise<{ error: Error | null }> {
  const client = getSupabase();
  if (!client) return { error: new Error('Supabase not configured') };

  if (Platform.OS === 'web') {
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'https://caps.ftable.co.il' },
    });
    return { error: error as Error | null };
  }

  // Native: deep-link redirect via expo-auth-session
  const redirectUrl = AuthSession.makeRedirectUri({ scheme: 'caps' });
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
  });

  if (data?.url) {
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
    if (result.type === 'success') {
      const url = new URL(result.url);
      const accessToken = url.searchParams.get('access_token');
      const refreshToken = url.searchParams.get('refresh_token');
      if (accessToken) {
        await client.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken ?? '',
        });
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
