/**
 * UpdateBanner — prominent overlay showing version + OTA hash
 * Helps Roye verify which OTA bundle is currently active.
 * Shows: app version, build number, OTA update ID short hash, embedded marker.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';

// HARDCODED MARKER — bumped manually each time we want to verify a new OTA arrived.
// If you see this number on the phone, that OTA bundle is active.
const BUNDLE_MARKER = 'V11';

export default function UpdateBanner() {
  const [expanded, setExpanded] = useState(false);

  const appVersion = Constants.expoConfig?.version || '?';
  const buildNumber = Application.nativeBuildVersion
    || Constants.expoConfig?.ios?.buildNumber
    || Constants.expoConfig?.android?.versionCode?.toString()
    || '?';
  const updateId = Updates.updateId ? Updates.updateId.slice(0, 8) : 'embedded';
  const channel = Updates.channel || '-';
  const isEmbedded = Updates.isEmbeddedLaunch;
  const runtimeVersion = Updates.runtimeVersion || '?';

  const compact = `v${appVersion} b${buildNumber} • ${BUNDLE_MARKER} • ${isEmbedded ? 'EMBED' : updateId}`;

  return (
    <Pressable onPress={() => setExpanded(!expanded)} style={styles.banner}>
      <Text style={styles.text}>{compact}</Text>
      {expanded && (
        <View style={styles.details}>
          <Text style={styles.detailText}>App Version: {appVersion}</Text>
          <Text style={styles.detailText}>Build Number: {buildNumber}</Text>
          <Text style={styles.detailText}>Runtime: {runtimeVersion}</Text>
          <Text style={styles.detailText}>Channel: {channel}</Text>
          <Text style={styles.detailText}>Update ID: {updateId}</Text>
          <Text style={styles.detailText}>Embedded: {isEmbedded ? 'yes' : 'no'}</Text>
          <Text style={styles.detailText}>Bundle Marker: {BUNDLE_MARKER}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 8,
    backgroundColor: '#FF00AA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    zIndex: 9999,
    elevation: 9999,
    borderWidth: 1,
    borderColor: '#FFF',
  },
  text: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  details: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.4)',
  },
  detailText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
