import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { COLORS } from '../constants/gameConfig';

interface CompleteOverlayProps {
  winner: 'player' | 'bot';
  bonusAmount: number;
  duration: number;
  onDone: () => void;
}

const { width, height } = Dimensions.get('window');

export default function CompleteOverlay({ winner, bonusAmount, duration, onDone }: CompleteOverlayProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDone();
    }, duration * 1000);
    return () => clearTimeout(timer);
  }, [duration, onDone]);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.content}>
        <Text style={styles.completeText}>COMPLETE!</Text>
        <Text style={styles.subText}>
          {winner === 'player' ? 'You swept' : 'Bot swept'} all boards!
        </Text>
        <View style={styles.bonusRow}>
          <Text style={styles.bonusLabel}>BONUS</Text>
          <Text style={styles.bonusAmount}>+{bonusAmount} 🪙</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  content: {
    alignItems: 'center',
    padding: 40,
  },
  completeText: {
    fontSize: 52,
    fontWeight: '900',
    color: COLORS.goldBright,
    letterSpacing: 8,
    textShadowColor: COLORS.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
    marginBottom: 16,
  },
  subText: {
    fontSize: 18,
    color: COLORS.textPrimary,
    marginBottom: 24,
  },
  bonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(212, 168, 67, 0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  bonusLabel: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  bonusAmount: {
    color: COLORS.goldBright,
    fontSize: 28,
    fontWeight: '900',
  },
});
