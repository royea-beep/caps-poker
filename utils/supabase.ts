import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Hardcoded fallback — safe to embed (anon key is public, RLS enforces security)
const FALLBACK_URL = 'https://gxrpunvhjcrzqnitbqah.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4cnB1bnZoamNyenFuaXRicWFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTc5OTksImV4cCI6MjA4ODkzMzk5OX0.MLHYIbU4saCHq0eQbwUzyfAl_q9TLgepKf8iNDDav-Q';

// Try expo-constants first (works in Expo runtime), fall back to hardcoded
let SUPABASE_URL = FALLBACK_URL;
let SUPABASE_ANON_KEY = FALLBACK_KEY;

try {
  // expo-constants provides app.json extra values at runtime
  const Constants = require('expo-constants').default;
  const extra = Constants.expoConfig?.extra;
  if (extra?.supabaseUrl) SUPABASE_URL = extra.supabaseUrl;
  if (extra?.supabaseAnonKey) SUPABASE_ANON_KEY = extra.supabaseAnonKey;
} catch {
  // Not in Expo runtime (e.g. Node test environment) — use fallbacks
}

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // WEB MUST BE TRUE. Google returns to https://caps.ftable.co.il/?code=... and supabase-js
        // is the ONLY thing that exchanges that code on web: the deep-link handler in
        // app/_layout.tsx bails out with `if (Platform.OS === 'web') return`. With this false
        // (as it was from the original anon-auth commit 732a4b3, 2026-04-23) the callback was
        // silently dropped — proven on the wire: loading the live site with ?code= present fired
        // 19 Supabase calls and ZERO /auth/v1/token. Web Google sign-in never completed, which is
        // why the only two google identities in the DB both predate that commit.
        // Native stays false — it exchanges the code itself from the deep link.
        detectSessionInUrl: Platform.OS === 'web',
      },
    });
  }
  return _client;
}
