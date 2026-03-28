/**
 * Shop screen — spend chips on items from the poker shop.
 * Uses get_poker_shop + spend_chips Supabase RPCs.
 * device_id only — no user auth.
 */
import React, { useEffect, useState, useCallback } from 'react';
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
import { fetchPokerShop, spendChips, ShopItem, ShopData } from '../utils/supabaseEconomy';

export default function ShopScreen() {
  const router = useRouter();
  const chips = useGameStore((s) => s.chips);
  const addChips = useGameStore((s) => s.addChips);
  const trackChipsSpent = useGameStore((s) => s.trackChipsSpent);

  const [shopData, setShopData] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
  }, [loadShop]);

  const handleBuy = async (item: ShopItem) => {
    if (buying) return;
    setBuying(item.event_type);
    try {
      const deviceId = await getDeviceId();
      // Heatmap (D7)
      import('../utils/heatmap').then(({ trackEvent }) => {
        trackEvent('shop', 'buy_' + item.event_type, deviceId);
      }).catch(() => {});
      const result = await spendChips(deviceId, item.event_type);
      if (result?.success) {
        // Update local chip balance
        addChips(-result.chips_spent);
        trackChipsSpent(result.chips_spent);
        // Update shop balance + re-evaluate can_afford
        setShopData((prev) =>
          prev
            ? {
                balance: result.new_balance,
                items: prev.items.map((i) => ({
                  ...i,
                  can_afford: result.new_balance >= i.cost,
                })),
              }
            : prev
        );
        showToast(`-${result.chips_spent} 🎰`);
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
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>🎰 Chip Shop</Text>
        <View style={styles.balancePill}>
          <Text style={styles.balanceText}>💰 {chips.toLocaleString()}</Text>
        </View>
      </View>

      {/* Toast */}
      {toast && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={COLORS.gold} size="large" />
          <Text style={styles.loadingText}>Loading shop...</Text>
        </View>
      ) : !shopData || shopData.items.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={styles.emptyText}>🃏</Text>
          <Text style={styles.emptySubText}>Shop is empty right now.</Text>
          <Pressable onPress={loadShop} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.itemList}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Available Items</Text>
          {shopData.items.map((item) => (
            <View key={item.event_type} style={styles.itemCard}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemDesc}>{item.description}</Text>
                {item.description_he ? (
                  <Text style={styles.itemDescHe}>{item.description_he}</Text>
                ) : null}
                <View style={styles.itemCostRow}>
                  <Text style={styles.itemCostLabel}>Cost: </Text>
                  <Text style={styles.itemCost}>💰 {item.cost.toLocaleString()}</Text>
                </View>
              </View>
              <Pressable
                style={[
                  styles.buyBtn,
                  !item.can_afford && styles.buyBtnDisabled,
                  buying === item.event_type && styles.buyBtnLoading,
                ]}
                disabled={!item.can_afford || buying !== null}
                onPress={() => handleBuy(item)}
              >
                {buying === item.event_type ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={[styles.buyBtnText, !item.can_afford && styles.buyBtnTextDisabled]}>
                    {item.can_afford ? 'Buy' : 'Can\'t afford'}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rs(16),
    paddingVertical: rs(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: {
    paddingVertical: rs(4),
    paddingRight: rs(12),
  },
  backText: {
    color: COLORS.gold,
    fontSize: rf(15),
    fontWeight: '600',
  },
  headerTitle: {
    color: '#fff',
    fontSize: rf(18),
    fontWeight: '800',
    letterSpacing: 1,
  },
  balancePill: {
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderRadius: rv(20),
    paddingHorizontal: rs(10),
    paddingVertical: rs(4),
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.35)',
  },
  balanceText: {
    color: COLORS.gold,
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
    color: COLORS.gold,
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
    borderColor: COLORS.gold,
  },
  retryBtnText: {
    color: COLORS.gold,
    fontSize: rf(14),
    fontWeight: '700',
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: rf(12),
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: rs(4),
    alignSelf: 'flex-start',
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
    color: 'rgba(255,255,255,0.55)',
    fontSize: rf(13),
    textAlign: Platform.OS === 'web' ? 'right' : 'left',
  },
  itemCostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: rs(2),
  },
  itemCostLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: rf(12),
  },
  itemCost: {
    color: COLORS.gold,
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
    color: 'rgba(255,255,255,0.3)',
  },
});
