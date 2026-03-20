import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Constants from 'expo-constants';

const version = Constants.expoConfig?.version ?? '?';
const build = Constants.expoConfig?.extra?.buildNumber ?? Constants.expoConfig?.ios?.buildNumber ?? '?';
const isBeta = Constants.expoConfig?.extra?.isBeta === true;

export function VersionBadge() {
  if (!__DEV__ && !isBeta) return null;
  return (
    <View style={[styles.badge, { pointerEvents: 'none' }]}>
      <Text style={styles.text}>
        v{version} ({build})
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    bottom: 4,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    zIndex: 9999,
  },
  text: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.22)',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
