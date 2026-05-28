/**
 * StarterOfferModal — first-time-only 2× chip offer ($2.99 → 10,000 chips).
 * Fetches eligibility from get_starter_offer_for_device RPC.
 * Hebrew RTL primary. Tracks shown/dismissed events.
 * IAP via RevenueCat react-native-purchases (product: starter_pack_2x).
 *
 * ⚠️  ROYE ACTION REQUIRED: Create product 'starter_pack_2x' in App Store Connect
 *    ($2.99 USD, Non-Consumable) and in RevenueCat dashboard before going live.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  I18nManager,
} from 'react-native';
import { getSupabase } from '../utils/supabase';
import { getDeviceId } from '../utils/leaderboard';
import { rf, rs, rv } from '../utils/responsive';
import { COLORS } from '../constants/gameConfig';
import { debugLog } from './DebugOverlay';

// RevenueCat — lazy-load on native only
let Purchases: typeof import('react-native-purchases').default | null = null;
if (Platform.OS !== 'web') {
  try { Purchases = require('react-native-purchases').default; } catch {}
}

interface StarterOffer {
  eligible: boolean;
  chips?: number;
  price_usd?: number;
  days_remaining?: number;
}

const STARTER_PRODUCT_ID = 'starter_pack_2x';
const SESSION_SHOWN_KEY = 'caps_starter_offer_shown_this_session';

// PR-G Bug 3: parent (lobby) gates other first-launch overlays (the
// InteractiveTutorial) on this callback so they don't stack on top of
// the offer. onResolved fires exactly once — when the offer has been
// shown-and-dismissed, OR when the eligibility check returns that no
// offer will be shown at all.
interface StarterOfferModalProps {
  onResolved?: () => void;
}

export function StarterOfferModal({ onResolved }: StarterOfferModalProps = {}) {
  const [offer, setOffer] = useState<StarterOffer | null>(null);
  const [visible, setVisible] = useState(false);
  const [buying, setBuying] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const shownRef = useRef(false);
  const resolvedRef = useRef(false);
  // PR-H: guard checkOffer against React 18 StrictMode double-invocation
  // (and any other re-entry). Without this guard the second useEffect call
  // would re-run checkOffer, see SESSION_SHOWN_KEY already set by the first,
  // and call resolve() while the offer modal is still on screen — opening
  // the tutorial gate one tick later and stacking both overlays.
  const inFlightRef = useRef(false);
  const resolve = (reason: string) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    debugLog(`[starter_offer] resolve fired: ${reason}`, 'info');
    onResolved?.();
  };

  useEffect(() => {
    void checkOffer();
  }, []);

  async function checkOffer() {
    // PR-H guard — synchronous, runs before any await so the StrictMode 2nd call
    // bails out before touching AsyncStorage / RPC / resolve().
    if (inFlightRef.current) {
      debugLog('[starter_offer] checkOffer skipped — already in flight (StrictMode 2nd call)', 'info');
      return;
    }
    inFlightRef.current = true;

    // Show only once per session
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const shown = await AsyncStorage.getItem(SESSION_SHOWN_KEY);
      if (shown) { resolve('session_shown_in_storage'); return; }
    } catch {}

    try {
      const sb = getSupabase();
      if (!sb) { resolve('supabase_unavailable'); return; }
      const deviceId = await getDeviceId();
      const { data, error } = await sb.rpc('get_starter_offer_for_device', {
        p_device_id: deviceId,
      });
      if (error || !data) {
        debugLog(`[starter_offer] RPC error: ${error?.message ?? 'no data'}`, 'warn');
        resolve('rpc_error_or_no_data');
        return;
      }
      const result = data as StarterOffer;
      setOffer(result);
      if (result.eligible) {
        setVisible(true);
        if (!shownRef.current) {
          shownRef.current = true;
          void trackEvent('shown');
          try {
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            await AsyncStorage.setItem(SESSION_SHOWN_KEY, '1');
          } catch {}
        }
      } else {
        resolve('not_eligible');
      }
    } catch (e) {
      debugLog(`[starter_offer] checkOffer threw: ${e}`, 'warn');
      resolve('exception_in_checkoffer');
    }
  }

  async function trackEvent(event: 'shown' | 'dismissed' | 'purchase_started' | 'purchase_success' | 'purchase_failed') {
    try {
      const sb = getSupabase();
      if (!sb) return;
      const deviceId = await getDeviceId();
      await sb.rpc('track_starter_offer_event', {
        p_device_id: deviceId,
        p_event: event,
      });
    } catch {}
  }

  function handleDismiss() {
    void trackEvent('dismissed');
    setVisible(false);
    resolve('user_dismissed');
  }

  async function handleBuy() {
    if (buying || !offer) return;
    setBuying(true);
    void trackEvent('purchase_started');

    try {
      if (!Purchases) {
        throw new Error('RevenueCat not available on this platform');
      }

      // Get available products from RevenueCat
      const offerings = await Purchases.getOfferings();
      const allPackages = offerings.current?.availablePackages ?? [];
      const starterPkg = allPackages.find(
        (p) => p.product.identifier === STARTER_PRODUCT_ID,
      );

      if (!starterPkg) {
        // Fallback: try purchaseStoreProduct directly
        debugLog('[starter_offer] package not in current offering, trying direct purchase', 'warn');
        const products = await Purchases.getProducts([STARTER_PRODUCT_ID]);
        if (!products.length) throw new Error(`Product ${STARTER_PRODUCT_ID} not found in store`);
        await Purchases.purchaseStoreProduct(products[0]);
      } else {
        await Purchases.purchasePackage(starterPkg);
      }

      // Purchase succeeded — redeem server-side
      const sb = getSupabase();
      const deviceId = await getDeviceId();
      if (sb) {
        const { data: { user } } = await sb.auth.getUser();
        await sb.rpc('redeem_starter_offer', {
          p_device_id: deviceId,
          p_user_id: user?.id ?? null,
          p_receipt_id: 'rc_purchase',
          p_platform: Platform.OS,
        });
      }

      void trackEvent('purchase_success');
      setPurchased(true);
      setTimeout(() => { setVisible(false); resolve('purchase_success'); }, 3000);
    } catch (e: unknown) {
      // RevenueCat throws with userCancelled flag — don't log cancellations as errors
      const err = e as { userCancelled?: boolean; message?: string };
      if (!err.userCancelled) {
        debugLog(`[starter_offer] purchase failed: ${err.message ?? e}`, 'warn');
        void trackEvent('purchase_failed');
      }
    } finally {
      setBuying(false);
    }
  }

  if (!visible || !offer?.eligible) return null;

  const chips = offer.chips?.toLocaleString() ?? '10,000';
  const price = offer.price_usd?.toFixed(2) ?? '2.99';
  const days = offer.days_remaining ?? 7;
  const isRTL = true; // Hebrew primary

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, isRTL && styles.cardRTL]}>
          {purchased ? (
            <SuccessView chips={chips} />
          ) : (
            <OfferView
              chips={chips}
              price={price}
              days={days}
              buying={buying}
              onBuy={handleBuy}
              onDismiss={handleDismiss}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function SuccessView({ chips }: { chips: string }) {
  return (
    <View style={styles.successContainer}>
      <Text style={styles.successEmoji}>🏆</Text>
      <Text style={[styles.successTitle, styles.rtlText]}>
        {chips} צ׳יפים שלך!
      </Text>
      <Text style={[styles.successSub, styles.rtlText]}>
        בהצלחה במשחק 🃏
      </Text>
    </View>
  );
}

interface OfferViewProps {
  chips: string;
  price: string;
  days: number;
  buying: boolean;
  onBuy: () => void;
  onDismiss: () => void;
}

function OfferView({ chips, price, days, buying, onBuy, onDismiss }: OfferViewProps) {
  return (
    <>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>פעם אחת בלבד</Text>
      </View>

      <Text style={[styles.title, styles.rtlText]}>מבצע פתיחה! 🎉</Text>

      <Text style={[styles.body, styles.rtlText]}>
        {chips} צ׳יפים ב-${price} בלבד
      </Text>

      <Text style={[styles.urgency, styles.rtlText]}>
        ⏳ נגמר בעוד {days} ימים
      </Text>

      <Text style={[styles.comparison, styles.rtlText]}>
        בדרך כלל: 5,000 צ׳יפים  ·  עכשיו: {chips} צ׳יפים ✨
      </Text>

      <Pressable
        style={[styles.ctaBtn, buying && styles.ctaBtnDisabled]}
        onPress={onBuy}
        disabled={buying}
      >
        {buying ? (
          <ActivityIndicator color="#1C0508" />
        ) : (
          <Text style={styles.ctaText}>קחו אותו! 🃏</Text>
        )}
      </Pressable>

      <Pressable style={styles.dismissBtn} onPress={onDismiss}>
        <Text style={styles.dismissText}>אולי אחר כך</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: rs(24),
  },
  card: {
    backgroundColor: '#1C0508',
    borderRadius: rs(16),
    borderWidth: 1,
    borderColor: COLORS.gold ?? '#c9a84c',
    paddingHorizontal: rs(24),
    paddingVertical: rv(28),
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  cardRTL: {
    direction: 'rtl' as never,
  },
  badge: {
    backgroundColor: '#c9a84c',
    borderRadius: rs(20),
    paddingHorizontal: rs(12),
    paddingVertical: rs(4),
    marginBottom: rv(12),
  },
  badgeText: {
    color: '#1C0508',
    fontSize: rf(11),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: rf(24),
    fontWeight: '900',
    color: '#c9a84c',
    marginBottom: rv(8),
    textAlign: 'center',
  },
  body: {
    fontSize: rf(18),
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: rv(6),
  },
  urgency: {
    fontSize: rf(13),
    color: '#ff9900',
    textAlign: 'center',
    marginBottom: rv(6),
  },
  comparison: {
    fontSize: rf(11),
    color: '#888',
    textAlign: 'center',
    marginBottom: rv(20),
  },
  ctaBtn: {
    backgroundColor: '#c9a84c',
    borderRadius: rs(12),
    paddingVertical: rv(14),
    paddingHorizontal: rs(32),
    width: '100%',
    alignItems: 'center',
    marginBottom: rv(10),
  },
  ctaBtnDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    color: '#1C0508',
    fontSize: rf(16),
    fontWeight: '900',
  },
  dismissBtn: {
    paddingVertical: rv(8),
  },
  dismissText: {
    color: '#666',
    fontSize: rf(13),
  },
  rtlText: {
    writingDirection: 'rtl',
    textAlign: 'center',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: rv(16),
  },
  successEmoji: {
    fontSize: rf(48),
    marginBottom: rv(12),
  },
  successTitle: {
    fontSize: rf(22),
    fontWeight: '900',
    color: '#c9a84c',
    marginBottom: rv(6),
  },
  successSub: {
    fontSize: rf(14),
    color: '#aaa',
  },
});
