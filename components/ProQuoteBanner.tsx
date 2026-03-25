import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { rv, rf, rs } from '../utils/responsive';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  cancelAnimation,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PRO_QUOTES, getRandomQuote, ProQuote } from '../constants/proQuotes';
import { getSupabase } from '../utils/supabase';
import { KILL_ProQuoteBanner } from '../utils/animationKill';
import { debugLog } from './DebugOverlay';

export const PRO_QUOTES_ENABLED_KEY = 'caps_show_pro_quotes';
export const PRO_VOICES_ENABLED_KEY = 'caps_pro_voices_enabled';
const VOICE_DISCLAIMER_SEEN_KEY = 'caps_voice_disclaimer_seen';

// Lazy expo-av — not available on web / some envs
let Audio: any = null;
try { Audio = require('expo-av').Audio; } catch {}

// ── Kill switch cache (5-minute TTL) ──────────────────────────────────────
let killSwitchCache: { value: boolean; ts: number } | null = null;
const KILL_SWITCH_TTL_MS = 5 * 60 * 1000;

async function checkKillSwitch(): Promise<boolean> {
  if (killSwitchCache && Date.now() - killSwitchCache.ts < KILL_SWITCH_TTL_MS) {
    return killSwitchCache.value;
  }
  try {
    const supabase = getSupabase();
    if (!supabase) return false;
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'pro_voices_enabled')
      .single();
    const enabled = data?.value === true;
    killSwitchCache = { value: enabled, ts: Date.now() };
    return enabled;
  } catch {
    return false; // Safe default: off if unreachable
  }
}

// ── Active sound instance (module-level — one clip at a time) ─────────────
let currentSound: any = null;

async function playVoiceClip(audioFile: any): Promise<void> {
  if (!Audio || !audioFile) return;
  try {
    if (currentSound) {
      await currentSound.stopAsync().catch(() => {});
      await currentSound.unloadAsync().catch(() => {});
      currentSound = null;
    }
    const { sound } = await Audio.Sound.createAsync(audioFile, { shouldPlay: true, volume: 0.8 });
    currentSound = sound;
    sound.setOnPlaybackStatusUpdate((status: any) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        if (currentSound === sound) currentSound = null;
      }
    });
  } catch (e) {
    debugLog(`[ProQuoteBanner] Voice playback failed: ${e}`, 'warn');
  }
}

async function stopVoiceClip(): Promise<void> {
  if (currentSound) {
    await currentSound.stopAsync().catch(() => {});
    await currentSound.unloadAsync().catch(() => {});
    currentSound = null;
  }
}

interface ProQuoteBannerProps {
  context: ProQuote['context'];
  rotating?: boolean;
  rotateInterval?: number;
}

export default function ProQuoteBanner({ context, rotating = false, rotateInterval = 8000 }: ProQuoteBannerProps) {
  const [quote, setQuote] = useState<ProQuote>(() => getRandomQuote(context));
  const [enabled, setEnabled] = useState(true);
  const [voicesEnabled, setVoicesEnabled] = useState(false); // conservative default
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [showFirstTimeNotice, setShowFirstTimeNotice] = useState(false);

  const opacity = useSharedValue(0);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const speakerPulse = useSharedValue(1);
  const speakerStyle = useAnimatedStyle(() => ({ opacity: speakerPulse.value }));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load text quotes setting
  useEffect(() => {
    AsyncStorage.getItem(PRO_QUOTES_ENABLED_KEY).then(val => {
      setEnabled(val !== 'false');
    }).catch(() => {});
  }, []);

  // Load voice setting + kill switch
  useEffect(() => {
    async function loadVoiceSetting() {
      const [localVal, killSwitch] = await Promise.all([
        AsyncStorage.getItem(PRO_VOICES_ENABLED_KEY).catch(() => null),
        checkKillSwitch(),
      ]);
      const localEnabled = localVal !== 'false'; // null = default ON
      setVoicesEnabled(localEnabled && killSwitch);
    }
    loadVoiceSetting();
  }, []);

  // Fade in on quote change
  useEffect(() => {
    opacity.value = withTiming(1, { duration: 500 });
  }, [quote]);

  // Speaker pulse animation while playing
  useEffect(() => {
    if (isPlayingVoice) {
      if (!KILL_ProQuoteBanner) {
        speakerPulse.value = withRepeat(
          withSequence(withTiming(0.3, { duration: 600 }), withTiming(1, { duration: 600 })),
          -1, true,
        );
      }
    } else {
      cancelAnimation(speakerPulse);
      speakerPulse.value = withTiming(1, { duration: 200 });
    }
    return () => { cancelAnimation(speakerPulse); };
  }, [isPlayingVoice]);

  // Play voice on quote change
  useEffect(() => {
    if (!voicesEnabled || !quote.audioFile || Platform.OS === 'web') return;

    let cancelled = false;
    (async () => {
      // First-time notice
      const seen = await AsyncStorage.getItem(VOICE_DISCLAIMER_SEEN_KEY).catch(() => null);
      if (!seen && !cancelled) {
        setShowFirstTimeNotice(true);
        await AsyncStorage.setItem(VOICE_DISCLAIMER_SEEN_KEY, 'true').catch(() => {});
        noticeTimer.current = setTimeout(() => {
          if (!cancelled) setShowFirstTimeNotice(false);
        }, 3000);
      }

      if (!cancelled) {
        setIsPlayingVoice(true);
        await playVoiceClip(quote.audioFile);
        // Track playing state via a brief timeout (clip is short)
        setTimeout(() => { if (!cancelled) setIsPlayingVoice(false); }, 8000);
      }
    })();

    return () => { cancelled = true; };
  }, [quote, voicesEnabled]);

  // Rotation interval
  useEffect(() => {
    if (!rotating || !enabled) return;
    intervalRef.current = setInterval(() => {
      opacity.value = withSequence(
        withTiming(0, { duration: 300 }),
        withTiming(0, { duration: 100 }),
      );
      setTimeout(() => {
        setQuote(getRandomQuote(context));
        setIsPlayingVoice(false);
      }, 400);
    }, rotateInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [rotating, enabled, context, rotateInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVoiceClip();
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  if (!enabled) return null;

  return (
    <View>
      {/* First-time voice notice */}
      {showFirstTimeNotice && (
        <View style={styles.firstTimeNotice}>
          <Text style={styles.firstTimeNoticeText}>
            🤖 Voice clips are AI-generated parody — not real player voices.{'\n'}For entertainment only.
          </Text>
        </View>
      )}

      <Animated.View style={[styles.container, fadeStyle]} pointerEvents="none">
        <Text style={styles.quoteText}>
          {voicesEnabled && isPlayingVoice && Platform.OS !== 'web' ? (
            <Animated.Text style={[styles.speakerIcon, speakerStyle]}>🔊 </Animated.Text>
          ) : null}
          {quote.emoji} <Text style={styles.italic}>"{quote.quote}"</Text>
          <Text style={styles.player}> — {quote.player}</Text>
        </Text>
        <Text style={styles.disclaimer}>🤖 AI Digital Simulation — Not real quotes</Text>
        {voicesEnabled && isPlayingVoice && Platform.OS !== 'web' && (
          <Text style={styles.audioDisclaimer}>🔊 AI-Generated Voice — Not the real person</Text>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderRadius: rv(10),
    paddingHorizontal: rs(12),
    paddingVertical: rs(8),
    marginHorizontal: rs(4),
    alignItems: 'center',
    ...Platform.select({
      web: { backdropFilter: 'blur(6px)' } as any,
      default: {},
    }),
  },
  quoteText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: rf(11),
    textAlign: 'center',
    lineHeight: rf(16),
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
    fontSize: rf(8),
    marginTop: rs(3),
    textAlign: 'center',
  },
  audioDisclaimer: {
    color: 'rgba(255,255,255,0.22)',
    fontSize: rf(8),
    marginTop: rs(1),
    textAlign: 'center',
  },
  speakerIcon: {
    fontSize: rf(10),
  },
  firstTimeNotice: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: rv(8),
    paddingHorizontal: rs(12),
    paddingVertical: rs(8),
    marginHorizontal: rs(4),
    marginBottom: rs(4),
    alignItems: 'center',
  },
  firstTimeNoticeText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: rf(10),
    textAlign: 'center',
    lineHeight: rf(14),
  },
});
