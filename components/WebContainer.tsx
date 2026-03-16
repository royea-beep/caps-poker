import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

/** Maximum content width for web layout containment (phone-width column). */
export const WEB_MAX_WIDTH = 480;

/**
 * Web-only layout containment wrapper.
 * On web: centers content in a phone-width column (max 480px) with dark gutters.
 * On native: transparent pass-through (just renders children with flex:1).
 */
export function WebContainer({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web') {
    return <View style={styles.native}>{children}</View>;
  }

  return (
    <View style={styles.webOuter}>
      <View style={styles.webInner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  native: {
    flex: 1,
  },
  webOuter: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#050f0a',
  },
  webInner: {
    flex: 1,
    width: '100%',
    maxWidth: WEB_MAX_WIDTH,
  },
});
