/**
 * ConnectionStatus — 8px dot indicator for online multiplayer connection state.
 * Green = connected, yellow = connecting, red = disconnected.
 * Shown in multiplayer-game.tsx top bar.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';

interface Props {
  connected: boolean;
  connecting?: boolean;
}

export default function ConnectionStatus({ connected, connecting = false }: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (connecting) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [connecting]);

  const dotColor = connected ? '#22C55E' : connecting ? '#F59E0B' : '#EF4444';

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.dot, { backgroundColor: dotColor, opacity: pulseAnim }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
