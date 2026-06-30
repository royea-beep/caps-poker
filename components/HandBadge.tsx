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
  const fontSize = size === 'small' ? rf(10) : rf(13);
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
