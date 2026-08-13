// VAMOS-VISUAL-PASS-1 2026-06-19 — shared header for secondary screens.
// Always: left chevron + "Back" + centered title. Right slot for optional
// trailing content (badge / chip count) to keep the title centered.
// Themed via COLORS tokens, sized via responsive units.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '../constants/gameConfig';
import { rf, rs, rv } from '../utils/responsive';
import { useSafeBack } from './BackControl';

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;             // override default router.back()
  right?: React.ReactNode;         // optional trailing slot
  showBackLabel?: boolean;         // default true; false on dense screens
}

export function ScreenHeader({ title, onBack, right, showBackLabel = true }: ScreenHeaderProps) {
  // DEAD-END FIX 2026-08-13. This was `onBack ?? (() => router.back())`. Measured on the live
  // deploy, both engines: navigating DIRECTLY to /shop or /heatmap — which is what a reloaded
  // tab or a shared link does — leaves the history stack empty, so router.back() silently
  // no-ops and this chevron does nothing. Entered in-app the same control works, which is why
  // it read as fine in every previous audit: they all walked in from Home.
  // On web the browser's own back button still rescues the tester. On iOS there is none.
  const safeBack = useSafeBack();
  const handleBack = onBack ?? safeBack;

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
