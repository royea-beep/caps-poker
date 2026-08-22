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

const DEFAULT_PACKAGES: ChipPackage[] = [
  { id: 'chips_99',   chips: 500,   price: '$0.99',  label: 'Starter Pack', badge: null         },
  { id: 'chips_299',  chips: 1500,  price: '$2.99',  label: 'Player Pack',  badge: 'POPULAR'    },
  { id: 'chips_499',  chips: 3000,  price: '$4.99',  label: 'Pro Pack',     badge: 'BEST VALUE' },
  { id: 'chips_999',  chips: 7500,  price: '$9.99',  label: 'High Roller',  badge: null         },
  { id: 'chips_1999', chips: 20000, price: '$19.99', label: 'VIP Bundle',   badge: 'VIP'        },
];

// --- Supabase fetch (non-blocking; mirrors fetchCardDisplayConfig pattern) ---

async function fetchChipStorePackages(): Promise<ChipPackage[]> {
  try {
    const sb = getSupabase();
    if (!sb) return DEFAULT_PACKAGES;
    const { data, error } = await sb
      .from('app_config')
      .select('value')
      .eq('key', 'chip_store_packages')
      .single();
    if (error || !data?.value) return DEFAULT_PACKAGES;
    const remote = data.value as ChipPackage[];
    return Array.isArray(remote) && remote.length > 0 ? remote : DEFAULT_PACKAGES;
  } catch {
    return DEFAULT_PACKAGES;
  }
}

// --- Component ---------------------------------------------------------------

export default function ChipStoreScreen() {
  const chips  = useGameStore((s) => s.chips);

  const [packages,       setPackages]       = useState<ChipPackage[]>(DEFAULT_PACKAGES);
  const [flashDismissed, setFlashDismissed] = useState(false);
  // PAYMENT-VERIFICATION 2026-08-22 — both rails are remote flags and BOTH ARE OFF. Fetched here
  // rather than at app start because this is the only screen that reads them, and re-rendered on
  // resolve so the gate below reflects the fetched value rather than the false default forever.
  const [, setFlagsResolved] = useState(false);

  // Stable social-proof numbers - seeded once on mount, never re-randomised
  const socialProof = useRef<number[]>(
    DEFAULT_PACKAGES.map(() => Math.floor(Math.random() * 151) + 50),
  );

  useEffect(() => {
    void import('../utils/webPayments')
      .then(({ loadWebPaymentsEnabled }) => loadWebPaymentsEnabled())
      .then(() => setFlagsResolved(true))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchChipStorePackages().then((pkgs) => {
      setPackages(pkgs);
      if (pkgs.length !== socialProof.current.length) {
        socialProof.current = pkgs.map(() => Math.floor(Math.random() * 151) + 50);
      }
    });
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
  const handleBuy = async (pkg: ChipPackage) => {
    const say = (title: string, msg: string) => {
      if (Platform.OS === 'web') { try { window.alert(title + '\n\n' + msg); } catch {} }
      else Alert.alert(title, msg, [{ text: 'OK' }]);
    };
    const res = await startCheckout(pkg.id);
    if (res.ok) { openCheckout(res.redirectUrl); return; }
    // Honest copy per reason. "no_provider" is a pending approval, not a broken button.
    say('Coming Soon', res.reason === 'no_provider'
      ? 'Card payment is not switched on yet.'
      : 'Purchases are not available yet.');
  };

  /** Provider redirect. Separate so the flow above stays provider-agnostic. */
  const openCheckout = (url: string) => {
    if (Platform.OS === 'web') { try { window.location.assign(url); } catch {} }
  };

  const handleRestorePurchases = () => {
    Alert.alert('Restore Purchases', 'In-app purchases are coming soon.', [{ text: 'OK' }]);
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
            {/* Package cards */}
            {packages.map((pkg, idx) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                buyersToday={socialProof.current[idx] ?? 75}
                onBuy={handleBuy}
              />
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
  buyersToday: number;
  onBuy:       (pkg: ChipPackage) => void;
}

function PackageCard({ pkg, buyersToday, onBuy }: PackageCardProps) {
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

      {/* Social proof */}
      <Text style={styles.socialProof}>{buyersToday} players bought today</Text>

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