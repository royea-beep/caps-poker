import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { readAuthCallbackError, type AuthCallbackError } from '../utils/authCallbackError';
import { rf, rs, rv } from '../utils/responsive';

/**
 * Shows why a Google sign-in did not complete.
 *
 * Mounted once in the root layout, next to WaitingSeatBanner, whose visual language it
 * follows. Before this, a failed callback was completely silent: the user came back from
 * Google to an ordinary home screen and had no way to tell that anything had gone wrong.
 *
 * Alert.alert does nothing on web (project hard rule), which is exactly the platform this
 * runs on, so the message has to be rendered.
 */
export default function AuthErrorBanner() {
  const [err, setErr] = useState<AuthCallbackError | null>(null);
  const insets = useSafeAreaInsets();

  // Read once on mount: readAuthCallbackError() also clears the params from the URL.
  useEffect(() => { setErr(readAuthCallbackError()); }, []);

  const dismiss = useCallback(() => setErr(null), []);

  if (!err) return null;

  return (
    <View style={[styles.wrap, { top: insets.top + rs(6) }]} pointerEvents="box-none">
      <View style={styles.banner}>
        <Text style={styles.text}>{err.message}</Text>
        <Pressable
          onPress={dismiss}
          style={styles.dismissBtn}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss sign-in message"
        >
          <Text style={styles.dismissText}>OK</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: rs(10),
    right: rs(10),
    zIndex: 1000,
    elevation: 1000,
    alignItems: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: rs(10),
    width: '100%',
    maxWidth: 430,
    backgroundColor: '#2A0E0E',
    borderWidth: 1.5,
    borderColor: '#c9a84c',
    borderRadius: rv(12),
    paddingVertical: rs(8),
    paddingHorizontal: rs(12),
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  text: {
    flex: 1,
    color: '#F5E7C8',
    fontWeight: '700',
    fontSize: rf(13, 11),
  },
  dismissBtn: {
    backgroundColor: '#c9a84c',
    borderRadius: rv(8),
    paddingVertical: rs(6),
    paddingHorizontal: rs(12),
  },
  dismissText: {
    color: '#2A0E0E',
    fontWeight: '900',
    fontSize: rf(12, 10),
  },
});
