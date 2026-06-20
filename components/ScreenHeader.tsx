// VAMOS-VISUAL-PASS-1 2026-06-19 — shared header for secondary screens.
// Always: left chevron + "Back" + centered title. Right slot for optional
// trailing content (badge / chip count) to keep the title centered.
// Themed via COLORS tokens, sized via responsive units.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../constants/gameConfig';
import { rf, rs, rv } from '../utils/responsive';

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;             // override default router.back()
  right?: React.ReactNode;         // optional trailing slot
  showBackLabel?: boolean;         // default true; false on dense screens
}

export function ScreenHeader({ title, onBack, right, showBackLabel = true }: ScreenHeaderProps) {
  const router = useRouter();
  const handleBack = onBack ?? (() => router.back());

  return (
    <View style={styles.header}>
      <Pressable
        onPress={handleBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={8}
        style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
      >
        <Text style={styles.backChevron}>{'‹'}</Text>
        {showBackLabel ? <Text style={styles.backLabel}>Back</Text> : null}
      </Pressable>
      <Text
        style={styles.title}
        numberOfLines={1}
        accessibilityRole="header"
      >
        {title}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rs(12),
    paddingVertical: rs(10),
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(4),
    minWidth: rs(72),
    minHeight: 44,
    paddingHorizontal: rs(4),
  },
  backBtnPressed: {
    opacity: 0.6,
  },
  backChevron: {
    color: COLORS.mint,
    fontSize: rf(26),
    lineHeight: rf(26),
    fontWeight: '700',
  },
  backLabel: {
    color: COLORS.mint,
    fontSize: rf(14),
    fontWeight: '700',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: COLORS.textPrimary,
    fontSize: rf(16),
    fontWeight: '800',
    letterSpacing: 1,
  },
  right: {
    minWidth: rs(72),
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
