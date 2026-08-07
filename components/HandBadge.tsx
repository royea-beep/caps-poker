import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { rf, rs } from '../utils/responsive';
import { HAND_COLORS } from '../utils/handColors';
import { getHandName } from '../utils/handNames';

export function HandBadge({ handName, size = 'normal' }: { handName: string; size?: 'small' | 'normal' }) {
  const config = HAND_COLORS[handName] ?? { bg: '#607D8B', text: '#fff' };
  // Single source of truth for the badge text: getHandName() returns the generic
  // English category name (e.g. "Two Pair") for all keys. Uppercased to match the
  // badge's bold/tracked style now that labels are English (Hebrew had no case).
  const label = (getHandName(handName) || handName).toUpperCase();
  // BU1 — THIS is what renders the hand names in the reveal, not Board.handName. The reveal's
  // 13px/10px names I previously attributed to `adjustsFontSizeToFit` shrinking a declared 16
  // were always these two literals; the arithmetic (16 × 0.65 ≈ 10) coincidentally matched and
  // made a wrong explanation look confirmed.
  //
  // The hand name is the single most important string at the moment a board resolves, so both
  // steps move up one level of the 1.25 scale: normal 13 -> 16 (primary information), small
  // 10 -> 13 (identity floor, and the minimum this app should render anywhere). `size="small"`
  // is the OPPONENT badge, which is exactly the text that was hardest to read.
  //
  // In-component (not module-scope), so this is the reactive `rf()` path on web.
  const fontSize = size === 'small' ? rf(13) : rf(16);
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.text, { color: config.text, fontSize }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: rs(6),
    paddingHorizontal: rs(10),
    paddingVertical: rs(4),
    alignSelf: 'center',
  },
  text: {
    fontWeight: '800',
    letterSpacing: 1.2,
  },
});
