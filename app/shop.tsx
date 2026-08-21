/**
 * Shop screen — spend chips on items from the poker shop.
 * Uses get_poker_shop + spend_chips Supabase RPCs.
 * device_id only — no user auth.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { t, getLanguage } from '../utils/i18n';
import { track } from '../utils/analytics';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useGameStore } from '../store/gameStore';
import { COLORS } from '../constants/gameConfig';
import { rf, rs, rv } from '../utils/responsive';
import { getDeviceId } from '../utils/leaderboard';
import { fetchPokerShop, purchaseItem, spendChips, ShopItem, ShopData, callRPC } from '../utils/supabaseEconomy';
import { isIapEnabled } from '../utils/iapEnabled';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase } from '../utils/supabase';
import { ScreenHeader } from '../components/ScreenHeader';

// Lazy-load RevenueCat (native only)
let Purchases: typeof import('react-native-purchases').default | null = null;
if (Platform.OS !== 'web') {
  try { Purchases = require('react-native-purchases').default; } catch {}
}
type RCPackage = { identifier: string; product: { priceString: string; title: string } };

export default function ShopScreen() {
  const router = useRouter();
  const chips = useGameStore((s) => s.chips);
  const addChips = useGameStore((s) => s.addChips);
  const trackChipsSpent = useGameStore((s) => s.trackChipsSpent);

  const [shopData, setShopData] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // IAP packages from RevenueCat
  const [starterPack, setStarterPack] = useState<RCPackage | null>(null);
  const [monthlyPack, setMonthlyPack] = useState<RCPackage | null>(null);
  const [iapLoading, setIapLoading] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const loadShop = useCallback(async () => {
    setLoading(true);
    try {
      const deviceId = await getDeviceId();
      const data = await fetchPokerShop(deviceId);
      setShopData(data);
    } catch {
      // silent — show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadShop();
    // Load RevenueCat offerings
    if (Purchases && Platform.OS !== 'web') {
      Purchases.getOfferings().then((offerings) => {
        const pkgs = (offerings.current?.availablePackages ?? []) as RCPackage[];
        setStarterPack(pkgs.find(p => p.identifier === 'starter_pack') ?? null);
        setMonthlyPack(pkgs.find(p => p.identifier === 'monthly_sub') ?? null);
      }).catch(() => {});
    }
  }, [loadShop]);

  const handleBuyStarterPack = async () => {
    if (!starterPack || iapLoading || !Purchases) return;
    setIapLoading(true);
    try {
      await Purchases.purchasePackage(starterPack as any);
      // Award 5000 chips via earn_chips RPC (or locally as fallback)
      const deviceId = await getDeviceId();
      // VAMOS-PURCHASE-TRUTH 2026-08-16 — was `result?.chips_earned ?? 5000`, which credited the
      // LOCAL wallet by a hardcoded fallback whenever the server refused or returned nothing. The
      // player saw +5,000 that the database never recorded, and it vanished on the next refresh —
      // the worst shape for a payment path, because it looks like the purchase worked.
      //
      // For most of this feature's life the server refused every one of these calls:
      // 'iap_starter_pack' was not in earn_chips' allow-list, so the fallback was the ONLY thing
      // crediting anyone. The amount is now the server's to decide (app_config.starter_pack_chips)
      // and this reads it back rather than guessing.
      const result = await callRPC<{ ok?: boolean; chips_earned?: number; reason?: string }>('earn_chips', {
        p_device_id: deviceId,
        p_event_type: 'iap_starter_pack',
      });
      const earned = result?.ok === true ? (result.chips_earned ?? 0) : 0;
      if (earned <= 0) {
        // The money already left RevenueCat, so do not imply the purchase failed — only that the
        // chips have not arrived. Never move the wallet on an unconfirmed grant.
        showToast(result?.reason === 'already_granted'
          ? 'Starter Pack already claimed.'
          : 'Purchase received — chips did not arrive. Contact support.');
        return;
      }
      addChips(earned);
      trackChipsSpent(0); // no chips spent — real money purchase
      showToast(`+${earned} 💰 Starter Pack!`);
    } catch (e: any) {
      if (!e.userCancelled) showToast('Purchase failed. Try again.');
    } finally {
      setIapLoading(false);
    }
  };

  const handleBuySubscription = async () => {
    if (!monthlyPack || iapLoading || !Purchases) return;
    setIapLoading(true);
    try {
      await Purchases.purchasePackage(monthlyPack as any);
      await AsyncStorage.setItem('caps_is_subscriber', 'true');
      // Update DB if authenticated
      const sb = getSupabase();
      if (sb) {
        const { data: { session } } = await sb.auth.getSession();
        if (session?.user?.id) {
          await sb.from('profiles').update({ is_subscriber: true }).eq('id', session.user.id);
        }
      }
      showToast('🏆 VIP Activated! 1000 chips/day unlocked.');
    } catch (e: any) {
      if (!e.userCancelled) showToast('Purchase failed. Try again.');
    } finally {
      setIapLoading(false);
    }
  };

  const handleBuy = async (item: ShopItem) => {
    if (buying) return;
    setBuying(item.event_type);
    try {
      const deviceId = await getDeviceId();
      // Heatmap (D7)
      import('../utils/heatmap').then(({ trackEvent }) => {
        trackEvent('shop', 'buy_' + item.event_type, deviceId);
      }).catch(() => {});
      // VAMOS-CAPS-QA-ECONOMY-GATED: pass the real cost (the server otherwise
      // charges a flat 50) and tolerate a missing new_balance (the live RPC does
      // not return one) by deriving it from the known shop balance minus the spend.
      // SHOP-OWNERSHIP: purchase_item, not spendChips. It reads the price from the catalogue
      // itself, so the client no longer sends one — the old call passed item.cost and a modified
      // client could buy a 500-chip theme for 1. It also grants the entitlement in the same
      // transaction as the debit, which is the whole point: buying used to take the chips and
      // give nothing back.
      const result = await purchaseItem(deviceId, item.event_type);
      if (result?.ok) {
        const spent = result.already_owned ? 0 : (result.price ?? item.cost);
        if (spent > 0) {
          addChips(-spent);
          trackChipsSpent(spent);
        }
        setShopData((prev) => {
          if (!prev) return prev;
          const newBalance = result.new_balance ?? Math.max(0, prev.balance - spent);
          return {
            balance: newBalance,
            items: prev.items.map((i) => ({
              ...i,
              // Only a PERMANENT item becomes owned. rebuy_500 and the buy-ins are consumables:
              // marking those owned would let a player rebuy exactly once, ever.
              owned: i.event_type === item.event_type && result.permanent ? true : i.owned,
              can_afford: newBalance >= i.cost,
            })),
          };
        });
        track('purchase', { item: item.event_type, cost: spent }, 'shop');
        showToast(result.already_owned ? t().shopOwned : `-${spent} 🎰`);
      }
      // Insufficient balance handled inside callRPC (Alert shown there)
    } catch {
      // silent
    } finally {
      setBuying(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <ScreenHeader
        title="🎰 Chip Shop"
        right={
          <View style={styles.balancePill} accessibilityLabel={`Balance: ${(chips ?? 0).toLocaleString()} chips`}>
            <Text style={styles.balanceText} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">💰 {(chips ?? 0).toLocaleString()}</Text>
          </View>
        }
      />

      {/* Toast */}
      {toast && (
        <View style={styles.toastContainer} accessibilityLiveRegion="polite">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.centerState} accessibilityLiveRegion="polite">
          <ActivityIndicator color={COLORS.mint} size="large" />
          <Text style={styles.loadingText}>Loading shop...</Text>
        </View>
      ) : !shopData || shopData.items.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={styles.emptyText} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">🃏</Text>
          <Text style={styles.emptySubText}>Shop is empty right now.</Text>
          <Pressable onPress={loadShop} style={styles.retryBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel="Retry loading shop">
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.itemList}
          showsVerticalScrollIndicator={false}
        >
          {/* WHERE CHIPS COME FROM, when they cannot be bought. The IAP section below hides
              ENTIRELY on web and whenever iap_enabled is false — header included, so there is no
              empty frame — but that leaves a shop full of ways to SPEND chips and no statement of
              how to get them. Every source named here is real and pays today: daily_reward,
              daily_streak and the per-hand net all appear in chip_transactions. */}
          {!(Platform.OS !== 'web' && isIapEnabled()) && (
            <Text style={styles.earnHint} accessibilityRole="text">
              Chips come from playing — daily rewards, streaks, and winning boards.
            </Text>
          )}

          {/* ─── IAP Section ─────────────────────────────────────── */}
          {/* VAMOS-HIDE-IAP-506 — hidden until remote iap_enabled flag is true (products not
              configured in App Store Connect / RevenueCat; Apple rejects non-functional IAP). */}
          {Platform.OS !== 'web' && isIapEnabled() && (
            <View style={styles.iapSection}>
              <Text style={styles.sectionTitle} accessibilityRole="header">Premium</Text>
              {/* Starter Pack */}
              <View style={styles.iapCard}>
                <View style={styles.iapInfo}>
                  <Text style={styles.iapTitle} accessibilityLabel="Starter Pack">🎰 Starter Pack</Text>
                  <Text style={styles.iapDesc}>+5,000 chips · One-time purchase</Text>
                  {starterPack && (
                    <Text style={styles.iapPrice}>{starterPack.product.priceString}</Text>
                  )}
                </View>
                <Pressable
                  style={[styles.iapBtn, (iapLoading || !starterPack) && styles.iapBtnDisabled]}
                  onPress={handleBuyStarterPack}
                  disabled={iapLoading || !starterPack}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={starterPack ? `Buy Starter Pack for ${starterPack.product.priceString}` : 'Starter Pack coming soon'}
                  accessibilityState={{ disabled: iapLoading || !starterPack, busy: iapLoading }}
                >
                  {iapLoading ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <Text style={styles.iapBtnText}>
                      {starterPack ? 'Buy' : 'Soon'}
                    </Text>
                  )}
                </Pressable>
              </View>
              {/* Monthly Subscription */}
              <View style={styles.iapCard}>
                <View style={styles.iapInfo}>
                  <Text style={styles.iapTitle} accessibilityLabel="VIP Monthly">👑 VIP Monthly</Text>
                  <Text style={styles.iapDesc}>1,000 chips/day · Auto-renews</Text>
                  {monthlyPack && (
                    <Text style={styles.iapPrice}>{monthlyPack.product.priceString}/mo</Text>
                  )}
                </View>
                <Pressable
                  style={[styles.iapBtn, (iapLoading || !monthlyPack) && styles.iapBtnDisabled]}
                  onPress={handleBuySubscription}
                  disabled={iapLoading || !monthlyPack}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={monthlyPack ? `Subscribe to VIP Monthly for ${monthlyPack.product.priceString} per month` : 'VIP Monthly coming soon'}
                  accessibilityState={{ disabled: iapLoading || !monthlyPack, busy: iapLoading }}
                >
                  {iapLoading ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <Text style={styles.iapBtnText}>
                      {monthlyPack ? 'Subscribe' : 'Soon'}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}

          <Text style={styles.sectionTitle} accessibilityRole="header">Available Items</Text>
          {shopData.items.map((item) => (
            <View key={item.event_type} style={styles.itemCard}>
              <View style={styles.itemInfo}>
                {/* PR-I: was rendering English title + Hebrew description side-by-side. */}
                {/* Now show only the active-locale string. */}
                <Text style={styles.itemDesc} accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined}>
                  {getLanguage() === 'he' && item.description_he ? item.description_he : item.description}
                </Text>
                {/* PR-I: keep the secondary <Text> branch dead but parser-safe. */}
                {false ? (
                  <Text style={styles.itemDescHe} accessibilityLanguage="he">{item.description_he}</Text>
                ) : null}
                <View style={styles.itemCostRow} accessibilityLabel={`Cost: ${(item.cost ?? 0).toLocaleString()} chips`}>
                  <Text style={styles.itemCostLabel} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">Cost: </Text>
                  <Text style={styles.itemCost} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">💰 {(item.cost ?? 0).toLocaleString()}</Text>
                </View>
              </View>
              <Pressable
                style={[
                  styles.buyBtn,
                  (item.owned || !item.can_afford) && styles.buyBtnDisabled,
                  buying === item.event_type && styles.buyBtnLoading,
                ]}
                disabled={item.owned || !item.can_afford || buying !== null}
                onPress={() => handleBuy(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={item.owned
                  ? `${item.description}, already owned`
                  : `Buy ${item.description} for ${(item.cost ?? 0).toLocaleString()} chips`}
                accessibilityState={{ disabled: item.owned || !item.can_afford || buying !== null, busy: buying === item.event_type }}
              >
                {buying === item.event_type ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={[styles.buyBtnText, (item.owned || !item.can_afford) && styles.buyBtnTextDisabled]} accessibilityLanguage={getLanguage() === 'he' ? 'he' : undefined}>
                    {item.owned ? t().shopOwned : item.can_afford ? t().shopBuy : t().shopCantAfford}
                  </Text>
                )}
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  balancePill: {
    backgroundColor: 'rgba(79,214,168,0.15)',
    borderRadius: rv(20),
    paddingHorizontal: rs(10),
    paddingVertical: rs(4),
    borderWidth: 1,
    borderColor: 'rgba(79,214,168,0.35)',
  },
  balanceText: {
    color: COLORS.mint,
    fontSize: rf(13),
    fontWeight: '700',
  },
  toastContainer: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(20,20,20,0.9)',
    borderRadius: 24,
    paddingHorizontal: rs(20),
    paddingVertical: rs(10),
    zIndex: 100,
  },
  toastText: {
    color: COLORS.mint,
    fontSize: rf(20),
    fontWeight: '900',
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: rs(12),
  },
  loadingText: {
    color: COLORS.textDim,
    fontSize: rf(14),
    marginTop: rs(8),
  },
  emptyText: {
    fontSize: rf(48),
  },
  emptySubText: {
    color: COLORS.textDim,
    fontSize: rf(16),
  },
  retryBtn: {
    marginTop: rs(8),
    paddingHorizontal: rs(24),
    paddingVertical: rs(10),
    borderRadius: rv(12),
    borderWidth: 1,
    borderColor: COLORS.mint,
  },
  retryBtnText: {
    color: COLORS.mint,
    fontSize: rf(14),
    fontWeight: '700',
  },
  earnHint: { color: 'rgba(255,255,255,0.75)', fontSize: rf(12), textAlign: 'center', marginBottom: rs(10), paddingHorizontal: rs(12) },
  sectionTitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: rf(12),
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: rs(4),
    alignSelf: 'flex-start',
  },
  iapSection: {
    width: '100%',
    gap: rs(8),
    marginBottom: rs(4),
  },
  iapCard: {
    backgroundColor: 'rgba(79,214,168,0.08)',
    borderRadius: rv(14),
    borderWidth: 1,
    borderColor: 'rgba(79,214,168,0.3)',
    padding: rs(14),
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(12),
  },
  iapInfo: {
    flex: 1,
    gap: rs(3),
  },
  iapTitle: {
    color: '#fff',
    fontSize: rf(15),
    fontWeight: '800',
  },
  iapDesc: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: rf(12),
  },
  iapPrice: {
    color: COLORS.mint,
    fontSize: rf(13),
    fontWeight: '700',
    marginTop: rs(2),
  },
  iapBtn: {
    backgroundColor: COLORS.mint,
    borderRadius: rv(10),
    paddingHorizontal: rs(14),
    paddingVertical: rs(10),
    minWidth: rs(80),
    alignItems: 'center',
  },
  iapBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  iapBtnText: {
    color: '#000',
    fontSize: rf(13),
    fontWeight: '800',
  },
  itemList: {
    padding: rs(16),
    gap: rs(12),
  },
  itemCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: rv(14),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: rs(14),
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(12),
  },
  itemInfo: {
    flex: 1,
    gap: rs(4),
  },
  itemDesc: {
    color: '#fff',
    fontSize: rf(15),
    fontWeight: '700',
  },
  itemDescHe: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: rf(13),
    textAlign: Platform.OS === 'web' ? 'right' : 'left',
  },
  itemCostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: rs(2),
  },
  itemCostLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: rf(12),
  },
  itemCost: {
    color: COLORS.mint,
    fontSize: rf(13),
    fontWeight: '700',
  },
  buyBtn: {
    backgroundColor: COLORS.neonGreen,
    borderRadius: rv(10),
    paddingHorizontal: rs(16),
    paddingVertical: rs(10),
    minWidth: rs(80),
    alignItems: 'center',
  },
  buyBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  buyBtnLoading: {
    opacity: 0.7,
  },
  buyBtnText: {
    color: '#000',
    fontSize: rf(13),
    fontWeight: '800',
  },
  buyBtnTextDisabled: {
    color: 'rgba(255,255,255,0.7)',
  },
});
