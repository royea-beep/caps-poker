import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

/** Maximum content width for web layout containment. 900px on desktop, fills phone screens. */
// Verified by claude-code-action pipeline test 2026-04-02
export const WEB_MAX_WIDTH = 430;

// PR-K final — clip any horizontal overflow on web (RTL text / wide children
// would otherwise push the body wider than the viewport at < 430 widths).
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('pr-k-rtl-clip')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'pr-k-rtl-clip';
  styleEl.textContent = `
    html, body, #root { overflow-x: hidden !important; max-width: 100vw !important; }
  `;
  document.head.appendChild(styleEl);
}

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
    // PR-K final — clip horizontal overflow so RTL / wide children don't push
    // the body wider than the viewport at < 430 widths.
    overflow: 'hidden',
  },
  webInner: {
    flex: 1,
    width: '100%',
    maxWidth: WEB_MAX_WIDTH,
    overflow: 'hidden',
  },
});
