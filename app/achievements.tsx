/**
 * Achievements Screen
 * Fetches from Supabase RPC get_achievements_list(user_id).
 * Category tabs -> 4-column badge grid -> tap-to-modal detail.
 * ZERO Reanimated -- RN Animated only.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { COLORS } from '../constants/gameConfig';
import { rf, rs, rv } from '../utils/responsive';
import { getSupabase } from '../utils/supabase';
import { getDeviceId } from '../utils/leaderboard';

// ─── Constants ───────────────────────────────────────────────

const BG      = '#1a0e06';
const ACCENT  = '#c96a1a';
const BORDER  = '#3d2a1a';
const TEXT    = '#f5e6d3';

const EARNED_BG     = 'rgba(201,106,26,0.18)';
const EARNED_BORDER = 'rgba(201,106,26,0.55)';
const UNEARNED_BG   = '#110a04';

const GRID_PADDING = rs(12);
const GRID_GAP     = rs(8);

// ─── Types ────────────────────────────────────────────────────

type Category = 'all' | 'skill' | 'streak' | 'milestone' | 'social' | 'collection';

interface AchievementItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'skill' | 'streak' | 'milestone' | 'social' | 'collection';
  chips_reward: number;
  xp_reward: number;
  is_earned: boolean;
  earned_at: string | null;
  progress?: number;
  target?: number;
}

// ─── Category Tab Bar ────────────────────────────────────────────────────

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'all',        label: 'הכל'     },
  { key: 'skill',      label: 'כישורים' },
  { key: 'streak',     label: 'רצף'     },
  { key: 'milestone',  label: 'אבן דרך' },
  { key: 'social',     label: 'חברתי'   },
  { key: 'collection', label: 'אוסף'    },
];

function CategoryTabs({
  active,
  onSelect,
}: {
  active: Category;
  onSelect: (c: Category) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabScrollContent}
      style={styles.tabScroll}
    >
      {CATEGORIES.map((cat) => {
        const isActive = cat.key === active;
        return (
          <Pressable
            key={cat.key}
            onPress={() => onSelect(cat.key)}
            style={({ pressed }) => [
              styles.tab,
              isActive && styles.tabActive,
              pressed && { opacity: 0.75 },
            ]}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {cat.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ─── Badge Cell ────────────────────────────────────────────────────────────────

function BadgeCell({
  item,
  size,
  onPress,
}: {
  item: AchievementItem;
  size: number;
  onPress: () => void;
}) {
  const hasProgress = item.progress !== undefined && item.target !== undefined && item.target > 0 && !item.is_earned;
  const progressPct = hasProgress ? Math.min(1, (item.progress ?? 0) / (item.target ?? 1)) : 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.badge,
        {
          width: size,
          height: size,
          backgroundColor: item.is_earned ? EARNED_BG : UNEARNED_BG,
          borderColor: item.is_earned ? EARNED_BORDER : BORDER,
        },
        pressed && { opacity: 0.75 },
      ]}
    >
      {/* emoji icon: opacity 0.3 when unearned simulates grayscale */}
      <Text
        style={[
          styles.badgeIcon,
          !item.is_earned && styles.badgeIconUnearned,
        ]}
      >
        {item.icon}
      </Text>

      {/* Progress bar — shown when in-progress */}
      {hasProgress && (
        <View style={styles.badgeProgressWrap}>
          <View style={[styles.badgeProgressFill, { width: (Math.round(progressPct * 100) + '%') as `${number}%` }]} />
        </View>
      )}

      {/* N/M label under icon */}
      {hasProgress && (
        <Text style={styles.badgeProgressLabel}>
          {item.progress}/{item.target}
        </Text>
      )}

      {/* bottom-right corner overlay — hide when progress label is showing */}
      {!hasProgress && (
        <View style={styles.badgeCorner}>
          <Text style={styles.badgeCornerIcon}>
            {item.is_earned ? '✓' : '🔒'}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// ─── Detail Modal ────────────────────────────────────────────────────────────────

function DetailModal({
  item,
  onClose,
}: {
  item: AchievementItem | null;
  onClose: () => void;
}) {
  const scaleAnim   = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (item) {
      scaleAnim.setValue(0.88);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          damping: 18,
          stiffness: 200,
        }),
      ]).start();
    }
  }, [item]);

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  }, [onClose]);

  if (!item) return null;

  const hasProgress =
    item.progress !== undefined &&
    item.target !== undefined &&
    item.target > 0;
  const progressPct = hasProgress
    ? Math.min(100, Math.round(((item.progress ?? 0) / (item.target ?? 1)) * 100))
    : 0;

  return (
    <Modal
      visible={!!item}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <Animated.View style={[styles.modalOverlay, { opacity: opacityAnim }]}>
        {/* tap outside to close */}
        <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} />

        <Animated.View
          style={[
            styles.modalCard,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          {/* Icon -- 48px */}
          <Text style={styles.modalIcon}>{item.icon}</Text>

          {/* Status pill */}
          <View
            style={[
              styles.modalStatusBadge,
              item.is_earned ? styles.modalStatusEarned : styles.modalStatusLocked,
            ]}
          >
            <Text style={styles.modalStatusText}>
              {item.is_earned ? '✓ פותח' : '🔒 נעול'}
            </Text>
          </View>

          {/* Name */}
          <Text style={styles.modalName}>{item.name}</Text>

          {/* Description */}
          <Text style={styles.modalDescription}>{item.description}</Text>

          {/* Reward: X chips + X XP */}
          <View style={styles.modalRewardRow}>
            {item.chips_reward > 0 && (
              <View style={styles.modalRewardPill}>
                <Text style={styles.modalRewardText}>
                  {'🟡 ' + (item.chips_reward ?? 0).toLocaleString() + " ז'טונים"}
                </Text>
              </View>
            )}
            {item.xp_reward > 0 && (
              <View style={styles.modalRewardPill}>
                <Text style={styles.modalRewardText}>
                  {'⚡ ' + item.xp_reward + ' XP'}
                </Text>
              </View>
            )}
          </View>

          {/* Progress bar -- only when available and not yet earned */}
          {hasProgress && !item.is_earned && (
            <View style={styles.modalProgressSection}>
              <View style={styles.modalProgressTrack}>
                <View
                  style={[
                    styles.modalProgressFill,
                    { width: (progressPct + '%') as any },
                  ]}
                />
              </View>
              <Text style={styles.modalProgressLabel}>
                {String(item.progress) + ' / ' + String(item.target)}
              </Text>
            </View>
          )}

          {/* Earned date */}
          {item.is_earned && item.earned_at ? (
            <Text style={styles.modalEarnedAt}>
              {'פותח ב-' + new Date(item.earned_at).toLocaleDateString('he-IL')}
            </Text>
          ) : null}

          {/* Close button */}
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [
              styles.modalCloseBtn,
              pressed && { opacity: 0.75 },
            ]}
          >
            <Text style={styles.modalCloseBtnText}>סגור</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────────────

export default function AchievementsScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();

  const [achievements, setAchievements]     = useState<AchievementItem[]>([]);
  const [loading, setLoading]               = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [selectedItem, setSelectedItem]     = useState<AchievementItem | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Badge size: 4 cols, GRID_PADDING each side, 3 gaps between 4 cols
  const badgeSize = Math.floor(
    (screenWidth - GRID_PADDING * 2 - GRID_GAP * 3) / 4,
  );

  // ── Load on mount ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const deviceId = await getDeviceId();
        const sb = getSupabase();
        if (!sb) {
          setLoading(false);
          return;
        }
        const { data, error } = await sb.rpc('get_achievements_list', {
          user_id: deviceId,
        });
        if (cancelled) return;
        if (!error && Array.isArray(data)) {
          setAchievements(data as AchievementItem[]);
        }
      } catch {
        // silent fail -- empty state shown
      } finally {
        if (!cancelled) {
          setLoading(false);
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }).start();
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // ── Filtered list ──────────────────────────────────────────────────────────────────
  const filtered = activeCategory === 'all'
    ? achievements
    : achievements.filter((a) => a.category === activeCategory);

  const earnedCount = achievements.filter((a) => a.is_earned).length;
  const totalCount  = achievements.length;

  // ── Render badge ───────────────────────────────────────────────────────────────────
  const renderBadge = useCallback(
    ({ item }: { item: AchievementItem }) => (
      <BadgeCell
        item={item}
        size={badgeSize}
        onPress={() => setSelectedItem(item)}
      />
    ),
    [badgeSize],
  );

  const keyExtractor = useCallback((item: AchievementItem) => item.id, []);

  // ── Loading state ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Text style={styles.backText}>{'חזרה ←'}</Text>
          </Pressable>
          <Text style={styles.title}>הישגים</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{'טוען...'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.backText}>{'חזרה ←'}</Text>
        </Pressable>
        <Text style={styles.title}>הישגים</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Counter subtitle */}
      <Text style={styles.subtitle}>
        {totalCount > 0
          ? (earnedCount + '/' + totalCount + ' פותחו')
          : 'אין הישגים עדיין'}
      </Text>

      {/* Category tabs */}
      <CategoryTabs active={activeCategory} onSelect={setActiveCategory} />

      {/* Badge grid */}
      <Animated.View style={[styles.gridWrapper, { opacity: fadeAnim }]}>
        {filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>{'🏆'}</Text>
            <Text style={styles.emptyTitle}>
              {activeCategory === 'all'
                ? 'לא נמצאו הישגים'
                : ('אין הישגים בקטגוריה ' + activeCategory)}
            </Text>
            <Text style={styles.emptySubtitle}>המשיכו לשחק כדי לפתוח פרסים</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={keyExtractor}
            renderItem={renderBadge}
            numColumns={4}
            key={activeCategory}
            contentContainerStyle={styles.gridContent}
            columnWrapperStyle={styles.gridRow}
            showsVerticalScrollIndicator={false}
          />
        )}
      </Animated.View>

      {/* Detail modal */}
      <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rs(16),
    paddingTop: rs(8),
    paddingBottom: rs(4),
  },
  backBtn: {
    minWidth: rs(60),
  },
  backText: {
    color: COLORS.mint,
    fontSize: rf(13),
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: {
    color: COLORS.mintLight,
    fontSize: rf(20),
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
  },

  // Subtitle counter
  subtitle: {
    color: 'rgba(245,230,211,0.45)',
    fontSize: rf(12),
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: rs(10),
    letterSpacing: 0.5,
  },

  // Category tabs
  tabScroll: {
    flexGrow: 0,
    marginBottom: rs(12),
  },
  tabScrollContent: {
    paddingHorizontal: rs(12),
    gap: rs(6),
  },
  tab: {
    paddingHorizontal: rs(14),
    paddingVertical: rs(7),
    borderRadius: rv(20),
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: 'rgba(61,42,26,0.4)',
  },
  tabActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  tabText: {
    color: 'rgba(245,230,211,0.5)',
    fontSize: rf(11),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: TEXT,
  },

  // Grid
  gridWrapper: {
    flex: 1,
  },
  gridContent: {
    paddingHorizontal: GRID_PADDING,
    paddingBottom: rs(32),
    gap: GRID_GAP,
  },
  gridRow: {
    gap: GRID_GAP,
  },

  // Badge cell
  badge: {
    borderRadius: rv(12),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badgeIcon: {
    fontSize: rf(26),
    lineHeight: rf(32),
  },
  badgeIconUnearned: {
    opacity: 0.3,
  },
  badgeCorner: {
    position: 'absolute',
    bottom: rs(3),
    right: rs(4),
  },
  badgeCornerIcon: {
    fontSize: rf(10),
    color: TEXT,
    opacity: 0.8,
  },
  badgeProgressWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: rs(3),
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  badgeProgressFill: {
    height: '100%',
    backgroundColor: ACCENT,
  },
  badgeProgressLabel: {
    position: 'absolute',
    bottom: rs(4),
    alignSelf: 'center',
    color: 'rgba(245,230,211,0.55)',
    fontSize: rf(8),
    fontWeight: '700',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: rf(14),
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(10),
    paddingTop: rs(60),
  },
  emptyIcon: {
    fontSize: rf(48),
  },
  emptyTitle: {
    color: TEXT,
    fontSize: rf(18),
    fontWeight: '700',
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: rf(13),
    textAlign: 'center',
    paddingHorizontal: rs(32),
  },

  // Modal overlay
  modalOverlay: {
    ...StyleSheet.absoluteFillObject as object,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: rs(24),
  },

  // Modal card
  modalCard: {
    width: '100%',
    backgroundColor: '#1e1208',
    borderRadius: rv(20),
    borderWidth: 1,
    borderColor: BORDER,
    padding: rs(24),
    alignItems: 'center',
    gap: rs(10),
  },
  modalIcon: {
    fontSize: rf(48),
    lineHeight: rf(56),
    marginBottom: rs(2),
  },
  modalStatusBadge: {
    paddingHorizontal: rs(12),
    paddingVertical: rs(4),
    borderRadius: rv(20),
    borderWidth: 1,
  },
  modalStatusEarned: {
    backgroundColor: 'rgba(201,106,26,0.15)',
    borderColor: ACCENT,
  },
  modalStatusLocked: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderColor: BORDER,
  },
  modalStatusText: {
    color: TEXT,
    fontSize: rf(10),
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  modalName: {
    color: COLORS.mintLight,
    fontSize: rf(20),
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 1,
  },
  modalDescription: {
    color: 'rgba(245,230,211,0.65)',
    fontSize: rf(13),
    textAlign: 'center',
    lineHeight: rf(19),
    paddingHorizontal: rs(4),
  },
  modalRewardRow: {
    flexDirection: 'row',
    gap: rs(8),
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: rs(2),
  },
  modalRewardPill: {
    backgroundColor: 'rgba(61,42,26,0.6)',
    borderRadius: rv(20),
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: rs(12),
    paddingVertical: rs(5),
  },
  modalRewardText: {
    color: TEXT,
    fontSize: rf(12),
    fontWeight: '700',
  },
  modalProgressSection: {
    width: '100%',
    gap: rs(4),
    marginTop: rs(4),
  },
  modalProgressTrack: {
    height: rs(8),
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: rv(4),
    overflow: 'hidden',
  },
  modalProgressFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: rv(4),
  },
  modalProgressLabel: {
    color: 'rgba(245,230,211,0.45)',
    fontSize: rf(11),
    textAlign: 'right',
  },
  modalEarnedAt: {
    color: 'rgba(245,230,211,0.35)',
    fontSize: rf(11),
    marginTop: rs(2),
  },
  modalCloseBtn: {
    marginTop: rs(8),
    backgroundColor: ACCENT,
    borderRadius: rv(12),
    paddingVertical: rs(12),
    paddingHorizontal: rs(40),
    alignItems: 'center',
  },
  modalCloseBtnText: {
    color: TEXT,
    fontSize: rf(13),
    fontWeight: '800',
    letterSpacing: 1.5,
  },
});
