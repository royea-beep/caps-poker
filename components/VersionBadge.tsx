import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { rf, rs } from '../utils/responsive';
import Constants from 'expo-constants';

const version = Constants.expoConfig?.version ?? '?';
const build = Constants.expoConfig?.extra?.buildNumber ?? Constants.expoConfig?.ios?.buildNumber ?? '?';

function getOtaInfo(): string {
  if (Platform.OS === 'web') return '';
  try {
    const Updates = require('expo-updates');
    if (Updates.isEmbeddedLaunch) return 'build';
    const id: string | null = Updates.updateId ?? null;
    return id ? `OTA:${id.slice(0, 8)}` : 'OTA:?';
  } catch {
    return '';
  }
}

// Computed once at module init (expo-updates is ready before JS runs)
const otaInfo = getOtaInfo();

export function VersionBadge() {
  // Always show — lets us confirm OTA status in TestFlight + production
  // Badge is extremely subtle (opacity 0.22) so real users won't notice
  return (
    <View style={[styles.badge, { pointerEvents: 'none' } as any]}>
      <Text style={styles.text}>
        v{version} ({build}){otaInfo ? ` | ${otaInfo}` : ''}
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
    paddingHorizontal: rs(7),
    paddingVertical: rs(3),
    zIndex: 9999,
  },
  text: {
    fontSize: rf(9),
    color: 'rgba(255,255,255,0.22)',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
