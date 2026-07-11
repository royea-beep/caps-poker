/**
 * S70 — Invite redeem web route: /invite/<code>.
 *
 * Opening a shared invite link (buildInviteUrl → caps.ftable.co.il/invite/<code>) lands
 * here. We identify the device, auto-call redeem_referral, grant the redeemer's welcome
 * bonus on success (record_reward once=true → server-deduped), and show the result. The
 * same route can later back a native universal/deep link with no changes here.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS } from '../../constants/gameConfig';
import { rf, rs, rv } from '../../utils/responsive';
import { getSupabase } from '../../utils/supabase';
import { getDeviceId } from '../../utils/leaderboard';
import { recordReward } from '../../utils/supabaseEconomy';
import { useGameStore } from '../../store/gameStore';

type RedeemState =
  | { phase: 'loading' }
  | { phase: 'success'; earned: number }
  | { phase: 'error'; message: string };

const WELCOME_BONUS = 100;

export default function InviteRedeemScreen() {
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const router = useRouter();
  const rawCode = Array.isArray(params.code) ? params.code[0] : params.code;
  const code = (rawCode || '').trim().toUpperCase();
  const [state, setState] = useState<RedeemState>({ phase: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!code || code.length !== 6) {
        if (!cancelled) setState({ phase: 'error', message: 'This invite link is missing a valid 6-character code.' });
        return;
      }
      try {
        const sb = getSupabase();
        if (!sb) {
          if (!cancelled) setState({ phase: 'error', message: 'Cannot reach the server right now. Please try again.' });
          return;
        }
        const deviceId = await getDeviceId();
        const { data, error } = await sb.rpc('redeem_referral', { p_device_id: deviceId, p_code: code });
        if (error || !data?.success) {
          // DB returns the reason in `data.error`
          // ('Already redeemed' | 'Invalid or expired code' | 'Cannot use own code' | 'Missing code').
          if (!cancelled) setState({ phase: 'error', message: data?.error ?? 'This code is invalid or already used.' });
          return;
        }
        // Grant the redeemer's welcome bonus — DB rewards only the referrer; once=true so
        // the server dedupes per device (safe to auto-call on every visit to this link).
        let earned = 0;
        try {
          const res = await recordReward(deviceId, WELCOME_BONUS, 'referral_welcome', true);
          if (res && res.granted > 0 && typeof res.new_balance === 'number') {
            earned = res.granted;
            useGameStore.getState().setChips(res.new_balance);
            useGameStore.getState().trackChipsEarned(res.granted);
          }
        } catch { /* economy RPC never crashes the UI */ }
        if (!cancelled) setState({ phase: 'success', earned: earned || WELCOME_BONUS });
      } catch {
        if (!cancelled) setState({ phase: 'error', message: 'Something went wrong. Please try again.' });
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  const goHome = useCallback(() => { router.replace('/'); }, [router]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.center}>
        <Text style={styles.logo}>🃏 CAPS Poker</Text>

        {state.phase === 'loading' && (
          <>
            <ActivityIndicator size="large" color={COLORS.mintBright} style={{ marginVertical: rs(18) }} />
            <Text style={styles.msg}>Redeeming your invite…</Text>
          </>
        )}

        {state.phase === 'success' && (
          <>
            <Text style={styles.title}>You're in! 🎉</Text>
            <Text style={styles.msg}>+{state.earned} 💰 welcome bonus added to your balance.</Text>
            <Pressable style={styles.cta} onPress={goHome} accessibilityRole="button" accessibilityLabel="Start playing CAPS">
              <Text style={styles.ctaText}>Start playing</Text>
            </Pressable>
          </>
        )}

        {state.phase === 'error' && (
          <>
            <Text style={styles.title}>Invite</Text>
            <Text style={styles.msg}>{state.message}</Text>
            <Pressable style={styles.cta} onPress={goHome} accessibilityRole="button" accessibilityLabel="Continue to CAPS">
              <Text style={styles.ctaText}>Continue to CAPS</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: rs(28) },
  logo: { color: '#F5E7C8', fontSize: rf(22, 18), fontWeight: '900', marginBottom: rs(20) },
  title: { color: COLORS.mintBright, fontSize: rf(24, 20), fontWeight: '900', marginBottom: rs(10), textAlign: 'center' },
  msg: { color: 'rgba(255,255,255,0.85)', fontSize: rf(15, 13), textAlign: 'center', lineHeight: rf(22, 20) },
  cta: {
    marginTop: rs(26),
    backgroundColor: '#c9a84c',
    borderRadius: rv(12),
    paddingVertical: rs(12),
    paddingHorizontal: rs(32),
    minHeight: 48,
    justifyContent: 'center',
  },
  ctaText: { color: '#2A0E0E', fontSize: rf(16, 14), fontWeight: '900' },
});
