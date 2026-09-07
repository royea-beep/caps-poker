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
import { recordReward } from '../utils/supabaseEconomy';
import { useGameStore } from '../store/gameStore';
import { buildInviteUrl, isPlausibleReferralCode, normaliseReferralCode, REFERRAL_CODE_MAX } from '../constants/appLinks';
import { ScreenHeader } from '../components/ScreenHeader';

// Suppress unused-import lint warning — COLORS used by pattern convention
void COLORS;

// ─── Constants ───────────────────────────────────────────────
const BG     = '#1a0e06';
const ACCENT = '#c96a1a';
const BORDER = '#3d2a1a';
const TEXT   = '#f5e6d3';
const GREEN  = '#27ae60';

// The two payouts, in ONE place, so the promise and the arithmetic cannot drift apart again.
// Both are DB ground truth, read from production rather than assumed:
//   redeem_referral  -> record_reward(referrer, 300, 'referral_joined')
//   the redeemer's welcome bonus is granted client-side below via record_reward(..., 100, once)
// If either payout changes in the database, change it HERE -- these render the copy as well.
const REFERRER_REWARD_CHIPS = 300;
const REDEEMER_WELCOME_CHIPS = 100;

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
  const rewardPerReferral = REFERRER_REWARD_CHIPS;

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

        // FINAL-QA 2026-08-22 — this used to read app_config.referral_both_get_chips and fall back
        // to 500. That key DOES NOT EXIST in production, so the fetch 406'd on every visit (the
        // only console error in the whole QA sweep) and the fallback 500 was always what won.
        // Nothing has ever paid 500: redeem_referral pays the referrer REFERRER_REWARD_CHIPS, and
        // the screen's own copy says 300. So "Chips earned" read joined x 500 while the player was
        // actually paid joined x 300 -- a player with two referrals was shown 1,000 for 600.
        // The figure now comes from the same constant the copy uses.
        const reward = REFERRER_REWARD_CHIPS;

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
    // The RECIPIENT is the redeemer, who is paid 100 ('referral_welcome') — not rewardPerReferral.
    // app_config.referral_both_get_chips says 500 and NOTHING pays 500: the sharer gets 300 from
    // redeem_referral, the redeemer 100.
    const message = `🃏 Come play CAPS with me!\nUse code ${myCode} to get a 100 💰 bonus!\n${buildInviteUrl(myCode)}`;
    try {
      await Share.share({ message });
    } catch {
      // user cancelled
    }
  }, [myCode, rewardPerReferral]);

  // Redeem a friend's code
  const handleRedeem = useCallback(async () => {
    const code = normaliseReferralCode(redeemInput);
    if (!isPlausibleReferralCode(code)) {
      showToast('That code does not look right. Check it and try again.');
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
        // S69 (A) — DB returns the reason in `data.error`
        // ('Already redeemed' | 'Invalid or expired code' | 'Cannot use own code' | 'Missing code').
        showToast(data?.error ?? 'Invalid code or already used.');
      } else {
        // S69 (A) — grant the redeemer's welcome bonus. The DB rewards only the REFERRER;
        // the redeemer's bonus is client-side via record_reward(once=true → server dedupes
        // per device forever, so it can never double-grant, incl. vs the Home redeem path).
        try {
          const res = await recordReward(deviceId, REDEEMER_WELCOME_CHIPS, 'referral_welcome', true);
          if (res && res.granted > 0 && typeof res.new_balance === 'number') {
            useGameStore.getState().setChips(res.new_balance);
            useGameStore.getState().trackChipsEarned(res.granted);
          }
        } catch { /* economy RPC never crashes the UI */ }
        showToast(`+${REDEEMER_WELCOME_CHIPS} 💰 Welcome bonus!`);
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
            You get {REFERRER_REWARD_CHIPS} 💰, they get {REDEEMER_WELCOME_CHIPS} 💰 when they join!
          </Text>
        </View>

        {/* Code card */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Your code</Text>
          {loading ? (
            <ActivityIndicator color={ACCENT} style={{ marginVertical: rv(12) }} />
          ) : (
            <Text style={styles.codeValue} selectable>
              {myCode ?? '--------'}
            </Text>
          )}
          <Pressable
            style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.8 }]}
            onPress={handleShare}
            disabled={!myCode}
            accessibilityRole="button"
            accessibilityLabel="Share your referral code to WhatsApp"
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
          <Text style={styles.redeemSub}>Enter it here and get 100 💰</Text>
          <View style={styles.redeemRow}>
            <TextInput
              style={styles.redeemInput}
              value={redeemInput}
              // THE-NEGLECTED 2026-09-03 — was `.slice(0, 6)`. The database issues EIGHT-character
              // codes, so this silently truncated a real code to six, which then PASSED
              // isPlausibleReferralCode (6 is the minimum) and sent a WRONG code to the server.
              // 2,008 codes, zero redemptions ever. Normalise + cap at the MAX the constant
              // declares; never re-derive the generator's length here (see constants/appLinks.ts).
              onChangeText={v => setRedeemInput(normaliseReferralCode(v).slice(0, REFERRAL_CODE_MAX))}
              placeholder="A3F2B1C7"
              placeholderTextColor="#666"
              maxLength={REFERRAL_CODE_MAX}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!submitting}
              // HALF-BUILT-SCREENS 2026-08-21 — this input had NO accessible name; the control
              // enumerator read it as a literal empty label "". Text inputs get their name from an
              // explicit label or nothing at all, and there is no visible <label> in RN.
              accessibilityLabel="Friend's referral code"
              textAlign={Platform.OS === 'ios' ? 'right' : undefined}
            />
            <Pressable
              style={({ pressed }) => [
                styles.redeemBtn,
                (submitting || !isPlausibleReferralCode(redeemInput)) && styles.redeemBtnDisabled,
                pressed && { opacity: 0.8 },
              ]}
              onPress={handleRedeem}
              disabled={submitting || !isPlausibleReferralCode(redeemInput)}
              accessibilityRole="button"
              accessibilityLabel="Redeem referral code"
              accessibilityState={{ disabled: submitting || !isPlausibleReferralCode(redeemInput), busy: submitting }}
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
            { emoji: '3️⃣', text: `You get ${REFERRER_REWARD_CHIPS} 💰, they get ${REDEEMER_WELCOME_CHIPS} 💰 instantly!` },
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
