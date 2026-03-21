import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PRO_QUOTES, getRandomQuote, ProQuote } from '../constants/proQuotes';

export const PRO_QUOTES_ENABLED_KEY = 'caps_show_pro_quotes';

interface ProQuoteBannerProps {
  context: ProQuote['context'];
  /** If true, rotates quote every `rotateInterval` ms */
  rotating?: boolean;
  rotateInterval?: number;
}

export default function ProQuoteBanner({ context, rotating = false, rotateInterval = 8000 }: ProQuoteBannerProps) {
  const [quote, setQuote] = useState<ProQuote>(() => getRandomQuote(context));
  const [enabled, setEnabled] = useState(true);
  const opacity = useSharedValue(0);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(PRO_QUOTES_ENABLED_KEY).then(val => {
      // null = never set = default ON
      setEnabled(val !== 'false');
    }).catch(() => {});
  }, []);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 500 });
  }, [quote]);

  useEffect(() => {
    if (!rotating || !enabled) return;
    intervalRef.current = setInterval(() => {
      opacity.value = withSequence(
        withTiming(0, { duration: 300 }),
        withTiming(0, { duration: 100 }),
      );
      setTimeout(() => {
        setQuote(getRandomQuote(context));
      }, 400);
    }, rotateInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [rotating, enabled, context, rotateInterval]);

  if (!enabled) return null;

  return (
    <Animated.View style={[styles.container, fadeStyle]} pointerEvents="none">
      <Text style={styles.quoteText}>
        {quote.emoji} <Text style={styles.italic}>"{quote.quote}"</Text>
        <Text style={styles.player}> — {quote.player}</Text>
      </Text>
      <Text style={styles.disclaimer}>🤖 AI Digital Simulation — Not real quotes</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 4,
    alignItems: 'center',
    ...Platform.select({
      web: { backdropFilter: 'blur(6px)' } as any,
      default: {},
    }),
  },
  quoteText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  italic: {
    fontStyle: 'italic',
  },
  player: {
    fontWeight: '700',
    fontStyle: 'normal',
    color: 'rgba(255,255,255,0.65)',
  },
  disclaimer: {
    color: 'rgba(255,255,255,0.28)',
    fontSize: 8,
    marginTop: 3,
    textAlign: 'center',
  },
});
