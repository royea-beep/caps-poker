/**
 * OpponentHeader — S118
 * Shows opponent avatar circle (initials), name, online status dot, and
 * animated "placing cards..." dots when opponent is still arranging.
 * Zero Reanimated — setInterval + useState only.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { rf, rs, rv } from '../utils/responsive';

// ─── Thinking dots ────────────────────────────────────────────────────────────

function ThinkingDots() {
  const [dots, setDots] = useState('.');
  useEffect(() => {
    const iv = setInterval(() => setDots(d => (d.length >= 3 ? '.' : d + '.')), 400);
    return () => clearInterval(iv);
  }, []);
  return <Text style={styles.dots}>placing cards{dots}</Text>;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface OpponentHeaderProps {
  name: string;
  isOnline: boolean;
  isThinking: boolean;
}

export function OpponentHeader({ name, isOnline, isThinking }: OpponentHeaderProps) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .map(w => w[0] ?? '')
      .join('')
      .toUpperCase()
      .slice(0, 2) || '??';

  return (
    <View style={styles.header}>
      {/* Avatar circle with online dot */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
        <View style={[styles.onlineDot, { backgroundColor: isOnline ? '#4CAF50' : '#9E9E9E' }]} />
      </View>

      {/* Name + status or thinking dots */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        {isThinking ? (
          <ThinkingDots />
        ) : (
          <Text style={styles.status}>
            {isOnline ? '🟢 Online' : '🔴 Disconnected'}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(8),
  },
  avatar: {
    width: rs(36),
    height: rs(36),
    borderRadius: rs(18),
    backgroundColor: 'rgba(201,168,76,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
  },
  avatarText: {
    fontSize: rf(13),
    fontWeight: '800',
    color: '#c9a84c',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: rs(10),
    height: rs(10),
    borderRadius: rs(5),
    borderWidth: 1.5,
    borderColor: '#1a1a2e',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: rf(13),
    fontWeight: '700',
    color: '#fff',
  },
  status: {
    fontSize: rf(10),
    color: 'rgba(255,255,255,0.5)',
    marginTop: rs(1),
  },
  dots: {
    fontSize: rf(10),
    color: 'rgba(201,168,76,0.75)',
    marginTop: rs(1),
    fontStyle: 'italic',
  },
});
