import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { rf, rs } from '../utils/responsive';
import Constants from 'expo-constants';
import * as Application from 'expo-application';

const version = Constants.expoConfig?.version ?? '?';
// Application.nativeBuildVersion reads from native binary's Info.plist — correct even with OTA
// Constants.expoConfig.ios.buildNumber reads bundled app.json — stays at 116 even when binary is 198
// WEB BUILD ID 2026-08-10 — on web `nativeBuildVersion` is null (there is no native binary), so
// this used to fall straight through to `extra.buildNumber` and print the abandoned 330 on every
// web build. A tester reading "build 330" and a bug_report carrying a commit sha do not agree,
// and every report then needs a second question.
//
// Web now shows the SAME identifier that rides in the telemetry payload, from the same source of
// truth: getBuildIdentity() in utils/analytics.ts — web_build (the commit sha, injected by
// web-deploy.yml) and web_bundle (the emitted bundle hash, read off the live <script> tag) as a
// fallback, since the two fail in different ways. Nothing new is computed here.
//
// Required lazily inside the function, not imported at module scope: web_bundle reads the DOM,
// and utils/analytics pulls in the Supabase client — neither belongs in this module's import
// graph just to render a label.
export function getDisplayBuild(): string {
  if (Platform.OS !== 'web') {
    // Native path deliberately unchanged: the binary's own build number.
    return Application.nativeBuildVersion
      ?? Constants.expoConfig?.extra?.buildNumber
      ?? Constants.expoConfig?.ios?.buildNumber
      ?? '?';
  }
  try {
    const { getBuildIdentity } = require('../utils/analytics');
    const id = getBuildIdentity?.();
    if (id?.web_build) return String(id.web_build).slice(0, 7);
    if (id?.web_bundle) return String(id.web_bundle).slice(0, 8);
  } catch { /* fall through rather than break the badge */ }
  return 'web';
}

const build = getDisplayBuild();

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
