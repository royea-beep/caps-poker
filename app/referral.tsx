/**
 * ReferralScreen — VAMOS 20
 * User's unique invite code, WhatsApp share, redeem a friend's code, stats.
 * Hebrew RTL. ZERO Reanimated — RN Animated only.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { COLORS } from '../constants/gameConfig';
import { rf, rs, rv } from '../utils/responsive';
import { getSupabase } from '../utils/supabase';
import { getDeviceId } from '../utils/leaderboard';
import { ScreenHeader } from '../components/ScreenHeader';

// Suppress unused-import lint warning — COLORS used by pattern convention
void COLORS;

// ─── Constants ───────────────────────────────────────────────
const BG     = '#1a0e06';
const ACCENT = '#c96a1a';
const BORDER = '#3d2a1a';
const TEXT   = '#f5e6d3';
const GREEN  = '#27ae60';

// ─── Toast helper ────────────────────────────────────────────
function Toast({ message, visible }: { message: string; visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  return (
    <Animated.View style={[styles.toast, { opacity }]} pointerEvents="none">
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────
export default function ReferralScreen() {
  const router = useRouter();

  const [myCode, setMyCode]             = useState<string | null>(null);
  const [redeemInput, setRedeemInput]   = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [loading, setLoading]           = useState(true);
  const [friendsJoined, setFriendsJoined] = useState(0);
  const [chipsEarned, setChipsEarned]   = useState(0);
  const [toastMsg, setToastMsg]         = useState('');
  const [toastVis, setToastVis]         = useState(false);
  const [rewardPerReferral, setRewardPerReferral] = useState(500);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVis(true);
    setTimeout(() => setToastVis(false), 2800);
  }, []);

  // Load code + stats on mount
  useEffect(() => {
    void (async () => {
      try {
        const deviceId = await getDeviceId();
        const sb = getSupabase();
        if (!sb) return;

        // Ensure code exists (idempotent RPC)
        // S68 (B) — create_referral_link returns json { success, code, ... } so `.code`
        // resolves; create_referral_code returns a bare text code (`.code` was undefined).
        const { data: codeData } = await sb.rpc('create_referral_link', { p_device_id: deviceId });
        if (codeData?.code) setMyCode(codeData.code as string);

        // Reward amount from app_config (fetched first so we can derive chips earned).
        const { data: cfg } = await sb
          .from('app_config')
          .select('value')
          .eq('key', 'referral_both_get_chips')
          .single();
        const reward = cfg?.value ? (Number(cfg.value) || 500) : 500;
        setRewardPerReferral(reward);

        // Referral stats from referral_links (real schema: per-link `conversions` count).
        // Was selecting non-existent chips_awarded/is_redeemed -> HTTP 400 (FIX-REFERRAL-PLAYOFDAY).
        const { data: links } = await sb
          .from('referral_links')
          .select('id, conversions')
          .eq('device_id', deviceId);

        if (links) {
          const joined = links.reduce((sum: number, l: any) => sum + (l.conversions ?? 0), 0);
          setFriendsJoined(joined);
          setChipsEarned(joined * reward);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Share via native share sheet (WhatsApp picks it up)
  const handleShare = useCallback(async () => {
    if (!myCode) return;
    const message = `🃏 Come play CAPS with me!\nUse code ${myCode} to get a ${rewardPerReferral} 💰 bonus!\nhttps://caps.app/invite/${myCode}`;
    try {
      await Share.share({ message });
    } catch {
      // user cancelled
    }
  }, [myCode, rewardPerReferral]);

  // Redeem a friend's code
  const handleRedeem = useCallback(async () => {
    const code = redeemInput.trim().toUpperCase();
    if (code.length !== 6) {
      showToast('Enter a 6-character code.');
      return;
    }
    Keyboard.dismiss();
    setSubmitting(true);
    try {
      const deviceId = await getDeviceId();
      const sb = getSupabase();
      if (!sb) return;
      const { data, error } = await sb.rpc('redeem_referral', {
        p_device_id: deviceId,
        p_code: code,
      });
      if (error || !data?.success) {
        showToast(data?.message ?? 'Invalid code or already used.');
      } else {
        showToast(`+${rewardPerReferral} 💰 received!`);
        setRedeemInput('');
      }
    } catch {
      showToast('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [redeemInput, rewardPerReferral, showToast]);

  return (
    <SafeAreaView style={styles.safe}>
      <Toast message={toastMsg} visible={toastVis} />

      {/* Header */}
      <ScreenHeader title="Invite Friends" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero */}
        <View style={styles.heroCard}>
          <Text style={styles.heroEmoji}>🎁</Text>
          <Text style={styles.heroTitle}>Invite friends</Text>
          <Text style={styles.heroCopy}>
            You both get {rewardPerReferral} 💰 when they join!
          </Text>
        </View>

        {/* Code card */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Your code</Text>
          {loading ? (
            <ActivityIndicator color={ACCENT} style={{ marginVertical: rv(12) }} />
          ) : (
            <Text style={styles.codeValue} selectable>
              {myCode ?? '------'}
            </Text>
          )}
          <Pressable
            style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.8 }]}
            onPress={handleShare}
            disabled={!myCode}
          >
            <Text style={styles.shareBtnText}>Share to WhatsApp 💬</Text>
          </Pressable>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{friendsJoined}</Text>
            <Text style={styles.statLabel}>Friends joined</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxBorder]}>
            <Text style={styles.statNumber}>{(chipsEarned ?? 0).toLocaleString()}</Text>
            <Text style={styles.statLabel}>Chips earned</Text>
          </View>
        </View>

        {/* Redeem section */}
        <View style={styles.redeemCard}>
          <Text style={styles.redeemTitle}>Got a friend's code?</Text>
          <Text style={styles.redeemSub}>Enter it here and get {rewardPerReferral} 💰</Text>
          <View style={styles.redeemRow}>
            <TextInput
              style={styles.redeemInput}
              value={redeemInput}
              onChangeText={v => setRedeemInput(v.toUpperCase().slice(0, 6))}
              placeholder="XXXXXX"
              placeholderTextColor="#666"
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!submitting}
              textAlign={Platform.OS === 'ios' ? 'right' : undefined}
            />
            <Pressable
              style={({ pressed }) => [
                styles.redeemBtn,
                (submitting || redeemInput.length !== 6) && styles.redeemBtnDisabled,
                pressed && { opacity: 0.8 },
              ]}
              onPress={handleRedeem}
              disabled={submitting || redeemInput.length !== 6}
            >
              {submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.redeemBtnText}>Redeem</Text>
              }
            </Pressable>
          </View>
        </View>

        {/* How it works */}
        <View style={styles.howCard}>
          <Text style={styles.howTitle}>How it works</Text>
          {[
            { emoji: '1️⃣', text: 'Share your code with a friend' },
            { emoji: '2️⃣', text: 'Your friend downloads CAPS and enters the code' },
            { emoji: '3️⃣', text: `You both get ${rewardPerReferral} 💰 instantly!` },
          ].map((step, i) => (
            <View key={i} style={styles.howRow}>
              <Text style={styles.howEmoji}>{step.emoji}</Text>
              <Text style={styles.howText}>{step.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: rs(16),
    paddingBottom: rv(40),
    gap: rs(14),
  },
  // Hero
  heroCard: {
    backgroundColor: 'rgba(201,106,26,0.12)',
    borderRadius: rs(16),
    borderWidth: 1,
    borderColor: BORDER,
    padding: rs(20),
    alignItems: 'center',
  },
  heroEmoji: { fontSize: rf(44), marginBottom: rv(6) },
  heroTitle: {
    color: ACCENT,
    fontSize: rf(22),
    fontWeight: '800',
    writingDirection: 'ltr',
  } as any,
  heroCopy: {
    color: TEXT,
    fontSize: rf(14),
    marginTop: rv(6),
    textAlign: 'center',
    writingDirection: 'ltr',
    opacity: 0.85,
  } as any,
  // Code
  codeCard: {
    backgroundColor: '#110a04',
    borderRadius: rs(16),
    borderWidth: 1,
    borderColor: BORDER,
    padding: rs(20),
    alignItems: 'center',
  },
  codeLabel: {
    color: '#888',
    fontSize: rf(13),
    marginBottom: rv(6),
    writingDirection: 'ltr',
  } as any,
  codeValue: {
    color: ACCENT,
    fontSize: rf(38),
    fontWeight: '900',
    letterSpacing: 6,
    marginBottom: rv(14),
  },
  shareBtn: {
    backgroundColor: GREEN,
    borderRadius: rs(12),
    paddingHorizontal: rs(28),
    paddingVertical: rv(13),
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  shareBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: rf(15),
    writingDirection: 'ltr',
  } as any,
  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: rs(10),
  },
  statBox: {
    flex: 1,
    backgroundColor: '#110a04',
    borderRadius: rs(14),
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: rv(16),
    alignItems: 'center',
  },
  statBoxBorder: {
    borderColor: 'rgba(201,106,26,0.35)',
  },
  statNumber: {
    color: ACCENT,
    fontSize: rf(28),
    fontWeight: '800',
  },
  statLabel: {
    color: '#888',
    fontSize: rf(12),
    marginTop: rv(3),
    writingDirection: 'ltr',
  } as any,
  // Redeem
  redeemCard: {
    backgroundColor: '#110a04',
    borderRadius: rs(16),
    borderWidth: 1,
    borderColor: BORDER,
    padding: rs(16),
  },
  redeemTitle: {
    color: TEXT,
    fontSize: rf(15),
    fontWeight: '700',
    textAlign: 'left',
    writingDirection: 'ltr',
    marginBottom: rv(4),
  } as any,
  redeemSub: {
    color: '#888',
    fontSize: rf(13),
    textAlign: 'left',
    writingDirection: 'ltr',
    marginBottom: rv(12),
  } as any,
  // VAMOS-VISUAL-PASS-1 2026-06-19 — was a row with flex:1 input + button at
  // its natural width; on 320pt the button slid past the card edge and clipped
  // the "Redeem" label. Input now flexShrink:1 + a smaller flex value so the
  // button keeps its minWidth at the right edge of the card.
  redeemRow: {
    flexDirection: 'row',
    gap: rs(8),
    alignItems: 'center',
    width: '100%',
  },
  redeemInput: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    backgroundColor: '#1a0e06',
    borderRadius: rs(10),
    borderWidth: 1,
    borderColor: BORDER,
    color: TEXT,
    fontSize: rf(18),
    fontWeight: '700',
    letterSpacing: 4,
    paddingHorizontal: rs(14),
    height: rs(44),
    textAlign: 'center',
  },
  redeemBtn: {
    flexShrink: 0,
    backgroundColor: ACCENT,
    borderRadius: rs(10),
    paddingHorizontal: rs(18),
    height: rs(44),
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: rs(96),
  },
  redeemBtnDisabled: { opacity: 0.45 },
  redeemBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: rf(14),
    writingDirection: 'ltr',
  } as any,
  // How it works
  howCard: {
    backgroundColor: '#110a04',
    borderRadius: rs(16),
    borderWidth: 1,
    borderColor: BORDER,
    padding: rs(16),
  },
  howTitle: {
    color: TEXT,
    fontSize: rf(15),
    fontWeight: '700',
    textAlign: 'left',
    writingDirection: 'ltr',
    marginBottom: rv(10),
  } as any,
  howRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(10),
    marginBottom: rv(8),
  },
  howEmoji: { fontSize: rf(18) },
  howText: {
    color: '#aaa',
    fontSize: rf(13),
    flex: 1,
    textAlign: 'left',
    writingDirection: 'ltr',
  } as any,
  // Toast
  toast: {
    position: 'absolute',
    bottom: rv(32),
    alignSelf: 'center',
    backgroundColor: '#222',
    paddingHorizontal: rs(20),
    paddingVertical: rv(10),
    borderRadius: rs(20),
    zIndex: 99,
  },
  toastText: {
    color: '#fff',
    fontSize: rf(14),
    fontWeight: '600',
    writingDirection: 'ltr',
  } as any,
});
