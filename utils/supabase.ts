import { createClient, SupabaseClient } from '@supabase/supabase-js';
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
        detectSessionInUrl: false,
      },
    });
  }
  return _client;
}
