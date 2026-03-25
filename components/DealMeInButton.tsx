import React from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import { rf, rs, rb, rv } from '../utils/responsive';

interface DealMeInButtonProps {
  label: string;
  onPress: () => void;
}

export function DealMeInButton({ label, onPress }: DealMeInButtonProps) {
  return (
    <View style={styles.btn}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.inner, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
      >
        <Text style={styles.text}>{label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: rv(16),
    backgroundColor: '#FFD700',
    marginHorizontal: rs(16),
    height: rb(64),
    ...Platform.select({
      ios: { shadowColor: '#FFD700', shadowOffset: { width: 0, height: 4 }, shadowRadius: 16, shadowOpacity: 0.5 },
      android: { elevation: 8 },
      default: {},
    }),
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: rv(16),
  },
  text: {
    color: '#000',
    fontSize: rf(20),
    fontWeight: '700',
    letterSpacing: 2,
  },
});
