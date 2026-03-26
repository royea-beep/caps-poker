/**
 * GuidedTooltip — S84 Guided First Game
 * Floating pill tooltip for contextual guidance during gameplay.
 * ZERO Reanimated — RN Animated only. Does NOT block gameplay.
 */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { rf, rs, rv } from '../utils/responsive';

interface GuidedTooltipProps {
  text: string;
  visible: boolean;
  onDismiss: () => void;
  position?: 'top' | 'bottom' | 'center';
  autoDismissMs?: number;
}

export default function GuidedTooltip({
  text,
  visible,
  onDismiss,
  position = 'bottom',
  autoDismissMs = 5000,
}: GuidedTooltipProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(onDismiss, autoDismissMs);
    } else {
      Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    }
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [visible, autoDismissMs]);

  if (!text) return null;

  const posStyle =
    position === 'top' ? styles.posTop :
    position === 'center' ? styles.posCenter :
    styles.posBottom;

  return (
    <Animated.View
      style={[styles.container, posStyle, { opacity }]}
      pointerEvents={visible ? 'box-only' : 'none'}
    >
      <Pressable onPress={onDismiss} style={styles.pill}>
        <Text style={styles.text}>{text}</Text>
        <Text style={styles.dismiss}>✕</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: rs(16),
    right: rs(16),
    zIndex: 100,
    alignItems: 'center',
  },
  posTop: {
    top: rs(90),
  },
  posCenter: {
    top: '38%' as any,
  },
  posBottom: {
    bottom: rs(110),
  },
  pill: {
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderRadius: rv(12),
    paddingVertical: rs(12),
    paddingHorizontal: rs(16),
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: rs(10),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    maxWidth: '100%',
  },
  text: {
    color: '#ffffff',
    fontSize: rf(14),
    fontWeight: '500',
    lineHeight: rf(21),
    flex: 1,
  },
  dismiss: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: rf(11),
    fontWeight: '600',
    marginTop: rs(2),
  },
});
