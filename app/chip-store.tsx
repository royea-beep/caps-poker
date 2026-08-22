/**
 * Chip Store screen - buy chip packages via IAP (UI only, coming soon).
 * Fetches packages from app_config table; falls back to hardcoded defaults.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../store/gameStore';
import { COLORS } from '../constants/gameConfig';
import { rf, rs, rv } from '../utils/responsive';
import { getSupabase } from '../utils/supabase';
import { safeBack } from '../components/BackControl';
import { isWebPaymentsEnabled, startCheckout } from '../utils/webPayments';

// --- Types -------------------------------------------------------------------

interface ChipPackage {
  id: string;
  chips: number;
  price: string;
  label: string;
  badge: 'POPULAR' | 'BEST VALUE' | 'VIP' | null;
}

// --- Defaults ----------------------------------------------------------------

/**
 * FINAL-QA 2026-08-22 — THE HARDCODED FALLBACK LADDER WAS DELETED. Do not reintroduce one.
 *
 * It listed chips_99 … chips_1999 at 500–20,000 chips, and it was dangerous in three ways:
 *   1. Its ids DO NOT EXIST in app_config.chip_store_packages, so credit_purchase returns
 *      `unknown_package` for every one of them. A player served the fallback could be shown a
 *      price, taken through checkout, and then not be creditable — a GUARANTEED failure with
 *      their money already gone.
 *   2. It was roughly a quarter of the live ladder's value.
 *   3. It reproduced the inverted-value bug we fixed on the live ladder the same day: its
 *      "POPULAR" tier gave 502 chips/$ against the tier below it at 505.
 *
 * A fallback that cannot be honoured is worse than no fallback. On failure the screen now says so
 * and offers no way to pay. Prices and chips have exactly one source: app_config.
 */

// --- Supabase fetch (non-blocking; mirrors fetchCardDisplayConfig pattern) ---

/**
 * Normalise ONE config row into what this screen renders.
 *
 * FINAL-QA 2026-08-22 — the store rendered every pack as "Buy 2,000 chips for undefined".
 * app_config stores `price_usd` as a NUMBER (0.99); this screen read `pkg.price` as a string,
 * and those two names have never agreed. Nobody saw it because the whole section is gated behind
 * (iap_enabled || web_payments_enabled) and both are false — so the defect was invisible until
 * the moment payments were switched on, which is the worst possible time to find it.
 *
 * That is the THIRD screen in three sprints where the server's field names and the component's
 * disagreed (achievements, missions, this). So this converts explicitly and VALIDATES: a row
 * without an id, a positive chip count and a usable price is DROPPED rather than rendered with a
 * hole in it. The screen would rather show four packs, or the honest error, than a price that
 * reads "undefined".
 *
 * The price here is DISPLAY ONLY. checkout still sends nothing but the package id — chips and
 * the charged amount come from app_config server-side, inside credit_purchase.
 */
function normalisePackage(raw: unknown): ChipPackage | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id : null;
  const chips = typeof r.chips === 'number' ? r.chips : Number(r.chips);
  // Accept either spelling, so a future config edit either way still renders.
  const usd = typeof r.price_usd === 'number' ? r.price_usd : Number(r.price_usd);
  const priceText = Number.isFinite(usd) ? `$${usd.toFixed(2)}`
    : typeof r.price === 'string' && r.price ? r.price : null;
  if (!id || !Number.isFinite(chips) || chips <= 0 || !priceText) return null;
  const badge = r.badge === 'POPULAR' || r.badge === 'BEST VALUE' || r.badge === 'VIP' ? r.badge : null;
  return {
    id,
    chips,
    price: priceText,
    label: typeof r.label === 'string' && r.label ? r.label : id,
    badge,
  };
}

/** Returns null when the ladder cannot be read. Null means "say so", never "invent one". */
async function fetchChipStorePackages(): Promise<ChipPackage[] | null> {
  try {
    const sb = getSupabase();
    if (!sb) return null;
    const { data, error } = await sb
      .from('app_config')
      .select('value')
      .eq('key', 'chip_store_packages')
      .single();
    if (error || !data?.value) return null;
    const remote = data.value;
    if (!Array.isArray(remote)) return null;
    const packages = remote.map(normalisePackage).filter((x): x is ChipPackage => x !== null);
    return packages.length > 0 ? packages : null;
  } catch {
    return null;
  }
}

// --- Component ---------------------------------------------------------------

export default function ChipStoreScreen() {
  const chips  = useGameStore((s) => s.chips);

  const [packages,       setPackages]       = useState<ChipPackage[] | null>(null);
  const [flashDismissed, setFlashDismissed] = useState(false);
  // PAYMENT-VERIFICATION 2026-08-22 — both rails are remote flags and BOTH ARE OFF. Fetched here
  // rather than at app start because this is the only screen that reads them, and re-rendered on
  // resolve so the gate below reflects the fetched value rather than the false default forever.
  const [, setFlagsResolved] = useState(false);

  useEffect(() => {
    void import('../utils/webPayments')
      .then(({ loadWebPaymentsEnabled }) => loadWebPaymentsEnabled())
      .then(() => setFlagsResolved(true))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchChipStorePackages().then(setPackages);
  }, []);

  /**
   * PAYMENT-VERIFICATION 2026-08-22 — the five chip packages are now WIRED, behind a flag that is
   * OFF. Before this they were a "Coming Soon" Alert, which is also a no-op on web.
   *
   * The client sends a PACKAGE ID and never a price or a chip amount: chips come from app_config
   * inside credit_purchase, and the credit only ever happens from a verified provider webhook
   * (supabase/functions/verify-purchase). The browser cannot assert a payment — credit_purchase is
   * revoked from anon and authenticated, proven by a direct call returning
   * "permission denied for function credit_purchase".
   */
  /**
   * Alert.alert IS A NO-OP ON WEB. This branch is not a style preference -- it is the reason
   * a message reaches the player at all, and it has caused three separate dead controls in
   * this codebase. Hoisted out of handleBuy in FINAL-QA so Restore Purchases can use it too:
   * Restore called Alert.alert directly, and therefore did NOTHING on web.
   */
  const say = (title: string, msg: string) => {
    if (Platform.OS === 'web') { try { window.alert(title + '\n\n' + msg); } catch {} }
    else Alert.alert(title, msg, [{ text: 'OK' }]);
  };

  const handleBuy = async (pkg: ChipPackage) => {
    const res = await startCheckout(pkg.id);
    if (res.ok) { openCheckout(res.redirectUrl); return; }
    // Honest copy per reason. "no_provider" is a pending approval, not a broken button.
    // The title used to read "Coming Soon" -- a promise about TIMING that nobody can keep:
    // the card rail waits on an acquirer approving this domain, and that has no date.
    say('Payment unavailable', res.reason === 'no_provider'
      ? 'Card payment is not switched on yet.'
      : 'Purchases are not available yet.');
  };

  /** Provider redirect. Separate so the flow above stays provider-agnostic. */
  const openCheckout = (url: string) => {
    if (Platform.OS === 'web') { try { window.location.assign(url); } catch {} }
  };

  const handleRestorePurchases = () => {
    // Was Alert.alert -- silent on web, so this button did nothing at all there. It sits
    // inside the payment gate, so no player has reached it yet: it would have gone live
    // already dead, exactly like the undefined price.
    say('Restore Purchases', 'Card payment is not switched on yet, so there is nothing to restore.');
  };

  return (
    <SafeAreaView style={styles.safeArea}>

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={safeBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backArrow} accessibilityElementsHidden importantForAccessibility="no">{'←'}</Text>
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle} accessibilityRole="header" accessibilityLabel="Chip Store">💰 Chip Store</Text>
        {/* Spacer mirrors back-button width so title stays visually centred */}
        <View style={styles.headerSpacer} />
      </View>

      {/* Balance */}
      <View style={styles.balanceContainer}>
        <Text style={styles.balanceLabel}>YOUR BALANCE</Text>
        <Text style={styles.balanceAmount} accessibilityLabel={`${(chips ?? 0).toLocaleString()} chips`}>💰 {(chips ?? 0).toLocaleString()}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* Flash deal banner */}
        {!flashDismissed && (
          <View
            style={styles.flashBanner}
            accessibilityLiveRegion="polite"
          >
            <Text style={styles.flashText} accessibilityLabel="Flash Deal — 2× chips for 24h!">⚡ Flash Deal — 2× chips for 24h!</Text>
            <Pressable
              onPress={() => setFlashDismissed(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              // VAMOS-14-SCREENS 2026-08-16 — the box measured 21x19. hitSlop 8 lifted the
              // touchable area to 37x35, still under 44, and hitSlop does not enlarge the box a
              // sweep can see. Sized the control itself instead so it passes on inspection and
              // in the hand; hitSlop stays as extra margin on top.
              style={({ pressed }) => [
                { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
                pressed && { opacity: 0.6 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Dismiss flash deal"
            >
              <Text style={styles.flashDismiss} accessibilityElementsHidden importantForAccessibility="no">✕</Text>
            </Pressable>
          </View>
        )}

        {/* VAMOS-HIDE-IAP-506 — no price-bearing purchase buttons while IAP is disabled
            (products not configured in App Store Connect; Apple rejects non-functional IAP).
            Same iap_enabled source of truth; reversible by flipping the flag. */}
        {(require('../utils/iapEnabled').isIapEnabled() || isWebPaymentsEnabled()) ? (
          <>
            {/* FINAL-QA 2026-08-22 — null means the ladder could not be read. Say so and offer no
                way to pay, rather than serving invented packages that credit_purchase would
                refuse. Prices and chips have one source: app_config. */}
            {packages === null ? (
              <Text style={[styles.restoreText, { textAlign: 'center', marginTop: 24 }]}>
                Chip packs are unavailable right now. Please try again later.
              </Text>
            ) : packages.map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} onBuy={handleBuy} />
            ))}

            {/* Restore purchases */}
            <Pressable
              onPress={handleRestorePurchases}
              style={({ pressed }) => [styles.restoreButton, pressed && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel="Restore previous purchases"
            >
              <Text style={styles.restoreText}>Restore Purchases</Text>
            </Pressable>
          </>
        ) : (
          <Text style={[styles.restoreText, { textAlign: 'center', marginTop: 24 }]}>
            💎 Chip packs are coming soon!
          </Text>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

// --- PackageCard -------------------------------------------------------------

interface PackageCardProps {
  pkg:         ChipPackage;
  onBuy:       (pkg: ChipPackage) => void;
}

function PackageCard({ pkg, onBuy }: PackageCardProps) {
  const badgeBg =
    pkg.badge === 'POPULAR'    ? '#c96a1a' :
    pkg.badge === 'BEST VALUE' ? '#8b6914' :
    pkg.badge === 'VIP'        ? '#7b3fa0' :
    'transparent';

  return (
    <View style={[styles.card, pkg.badge === 'POPULAR' && styles.cardHighlighted]}>

      {/* Name + badge */}
      <View style={styles.cardTopRow}>
        <Text style={styles.cardLabel}>{pkg.label}</Text>
        {pkg.badge !== null && (
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            <Text style={styles.badgeText}>{pkg.badge}</Text>
          </View>
        )}
      </View>

      {/* Chip amount */}
      <Text style={styles.cardChips} accessibilityLabel={`${(pkg.chips ?? 0).toLocaleString()} chips`}>💰 {(pkg.chips ?? 0).toLocaleString()} chips</Text>

      {/* FINAL-QA 2026-08-22 — REMOVED: "{n} players bought today", where n was
          Math.random()*151+50. There have been ZERO purchases, ever. It was a fabricated social
          claim shown to players, and inventing a number is not a placeholder, it is a false
          statement about other people. Nothing replaces it: we have no purchase data to show. */}

      {/* Price + CTA */}
      <View style={styles.ctaRow}>
        <Text style={styles.price}>{pkg.price}</Text>
        <Pressable
          onPress={() => onBuy(pkg)}
          style={({ pressed }) => [styles.buyButton, pressed && styles.buyButtonPressed]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`Buy ${(pkg.chips ?? 0).toLocaleString()} chips for ${pkg.price}`}
          accessibilityHint={pkg.badge === 'POPULAR' ? 'Most popular package' : undefined}
        >
          <Text style={styles.buyButtonText}>
            Buy {(pkg.chips ?? 0).toLocaleString()}💰 for {pkg.price}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// --- Palette -----------------------------------------------------------------

const BG       = '#1a0e06';
const CARD_BG  = '#2a1a0e';
const CARD_BD  = '#3d2a1a';
const GOLD_ACC = '#c96a1a';
const TEXT_PRI = '#f5e6d3';
const TEXT_SEC = '#a89070';

// --- Styles ------------------------------------------------------------------

const styles = StyleSheet.create({

  safeArea: {
    flex: 1,
    backgroundColor: BG,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: rs(16),
    paddingVertical: rs(10),
    borderBottomWidth: 1,
    borderBottomColor: CARD_BD,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(4),
    minWidth: rv(60),
    // DD4 2026-08-13 — measured 60x27 live; 44 is the a11y floor.
    minHeight: rs(44),
  },
  backButtonPressed: { opacity: 0.6 },
  backArrow: {
    fontSize: rf(20),
    color: GOLD_ACC,
    fontWeight: '600',
  },
  backLabel: {
    fontSize: rf(15),
    color: GOLD_ACC,
    fontWeight: '500',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: rf(20),
    fontWeight: '700',
    color: TEXT_PRI,
  },
  headerSpacer: { minWidth: rv(60) },

  // Balance strip
  balanceContainer: {
    alignItems: 'center',
    paddingVertical: rs(16),
    borderBottomWidth: 1,
    borderBottomColor: CARD_BD,
    backgroundColor: CARD_BG,
  },
  balanceLabel: {
    fontSize: rf(11),
    color: '#c9a884',
    letterSpacing: 1.2,
    fontWeight: '600',
    marginBottom: rs(4),
  },
  balanceAmount: {
    fontSize: rf(32),
    fontWeight: '800',
    color: TEXT_PRI,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: rs(16),
    paddingTop: rs(14),
  },

  // Flash banner
  flashBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2e1c06',
    borderWidth: 1,
    borderColor: GOLD_ACC,
    borderRadius: rv(10),
    paddingHorizontal: rs(14),
    paddingVertical: rs(10),
    marginBottom: rs(14),
  },
  flashText: {
    fontSize: rf(13),
    color: '#f0a050',
    fontWeight: '600',
    flex: 1,
  },
  flashDismiss: {
    fontSize: rf(14),
    color: TEXT_SEC,
    marginLeft: rs(10),
    fontWeight: '600',
  },

  // Package card
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BD,
    borderRadius: rv(12),
    padding: rs(16),
    marginBottom: rs(12),
  },
  cardHighlighted: {
    borderColor: GOLD_ACC,
    borderWidth: 1.5,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: rs(6),
  },
  cardLabel: {
    fontSize: rf(16),
    fontWeight: '700',
    color: TEXT_PRI,
  },
  badge: {
    borderRadius: rv(20),
    paddingHorizontal: rs(8),
    paddingVertical: rs(3),
  },
  badgeText: {
    fontSize: rf(10),
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.6,
  },
  cardChips: {
    fontSize: rf(20),
    fontWeight: '700',
    color: TEXT_PRI,
    marginBottom: rs(4),
  },
  socialProof: {
    fontSize: rf(12),
    color: '#c9a884',
    marginBottom: rs(12),
  },

  // CTA row
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(12),
  },
  price: {
    fontSize: rf(22),
    fontWeight: '800',
    color: TEXT_PRI,
    minWidth: rv(56),
  },
  buyButton: {
    flex: 1,
    backgroundColor: GOLD_ACC,
    borderRadius: rv(10),
    paddingVertical: rs(12),
    alignItems: 'center',
  },
  buyButtonPressed: { opacity: 0.75 },
  buyButtonText: {
    fontSize: rf(13),
    fontWeight: '700',
    color: '#fff',
  },

  // Restore
  restoreButton: {
    alignItems: 'center',
    paddingVertical: rs(18),
    marginTop: rs(4),
  },
  restoreText: {
    fontSize: rf(13),
    color: '#c9a884',
    textDecorationLine: 'underline',
  },

  bottomPad: { height: rs(24) },
});