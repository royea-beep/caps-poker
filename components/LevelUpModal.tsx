/**
 * LevelUpModal — celebration modal shown when a player levels up.
 * Animated scale-in card using RN Animated only — ZERO Reanimated.
 * Auto-closes after 3 seconds or on press.
 */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { rf, rs } from '../utils/responsive';

const GOLD = '#c96a1a';
const SURFACE = '#1a0e06';
const BORDER = '#3d2a1a';
const TEXT_PRIMARY = '#f5e6d3';
const TEXT_SECONDARY = '#78716C';
const OVERLAY = 'rgba(0,0,0,0.75)';

export interface LevelUpModalProps {
  visible: boolean;
  newLevel: number;
  onClose: () => void;
}

export default function LevelUpModal({ visible, newLevel, onClose }: LevelUpModalProps) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      // Reset and animate in
      scale.setValue(0);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-close after 3 seconds
      timerRef.current = setTimeout(() => {
        onClose();
      }, 3000);
    } else {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity,
              transform: [{ scale }],
            },
          ]}
        >
          {/* Title */}
          <Text style={styles.title}>LEVEL UP! 🎉</Text>

          {/* Level number display */}
          <View style={styles.levelCircle}>
            <Text style={styles.levelNumber}>{newLevel}</Text>
          </View>

          {/* Subtitle */}
          <Text style={styles.subtitle}>You reached Level {newLevel}!</Text>

          {/* Close button */}
          <Pressable style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Let's go!</Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: OVERLAY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: SURFACE,
    borderWidth: 2,
    borderColor: GOLD,
    borderRadius: rs(16),
    paddingHorizontal: rs(32),
    paddingVertical: rs(28),
    alignItems: 'center',
    minWidth: rs(260),
    gap: rs(16),
    shadowColor: GOLD,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  title: {
    color: GOLD,
    fontSize: rf(22),
    fontWeight: '900',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  levelCircle: {
    width: rs(72),
    height: rs(72),
    borderRadius: rs(36),
    borderWidth: 3,
    borderColor: GOLD,
    backgroundColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNumber: {
    color: GOLD,
    fontSize: rf(32),
    fontWeight: '900',
    includeFontPadding: false,
  },
  subtitle: {
    color: TEXT_PRIMARY,
    fontSize: rf(16),
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  button: {
    marginTop: rs(4),
    backgroundColor: GOLD,
    borderRadius: rs(10),
    paddingHorizontal: rs(28),
    paddingVertical: rs(12),
  },
  buttonText: {
    color: SURFACE,
    fontSize: rf(15),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
