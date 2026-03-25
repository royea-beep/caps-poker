/**
 * Tutorial — S66
 * Animated 5-step onboarding. ZERO Reanimated — RN Animated only.
 * i18n: Hebrew (RTL) + English. Triggered on first launch or from Settings.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../constants/gameConfig';
import { rv, rf, rs } from '../utils/responsive';
import { t, isRTL } from '../utils/i18n';

export const TUTORIAL_SEEN_KEY = 'caps_tutorial_seen';

const TOTAL_STEPS = 5;

// ─── Step 1 animation: 4 board icons appearing one by one ─────────────────

function Step1Visual() {
  const opacities = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const anims = opacities.map((op, i) =>
      Animated.timing(op, { toValue: 1, duration: 300, delay: i * 200, useNativeDriver: true })
    );
    const seq = Animated.stagger(200, anims);
    seq.start();
    return () => anims.forEach((a) => a.stop());
  }, []);

  return (
    <View style={vis.boardRow}>
      {opacities.map((op, i) => (
        <Animated.View key={i} style={[vis.boardBox, { opacity: op }]}>
          <Text style={vis.boardBoxLabel}>B{i + 1}</Text>
        </Animated.View>
      ))}
    </View>
  );
}

// ─── Step 2 animation: 4 cards "fly" onto boards ──────────────────────────

function Step2Visual() {
  const translateYs = Array.from({ length: 4 }, () =>
    useRef(new Animated.Value(-40)).current
  );
  const opacities2 = Array.from({ length: 4 }, () =>
    useRef(new Animated.Value(0)).current
  );

  useEffect(() => {
    const anims = translateYs.map((ty, i) =>
      Animated.parallel([
        Animated.timing(ty, { toValue: 0, duration: 350, delay: i * 120, useNativeDriver: true }),
        Animated.timing(opacities2[i], { toValue: 1, duration: 250, delay: i * 120, useNativeDriver: true }),
      ])
    );
    const seq = Animated.stagger(120, anims);
    seq.start();
    return () => anims.forEach((a) => a.stop());
  }, []);

  return (
    <View style={vis.cardFlyRow}>
      {translateYs.map((ty, i) => (
        <Animated.View key={i} style={[vis.flyCard, { transform: [{ translateY: ty }], opacity: opacities2[i] }]}>
          <Text style={vis.flyCardText}>🃏</Text>
          <Text style={vis.flyCardNum}>×4</Text>
        </Animated.View>
      ))}
    </View>
  );
}

// ─── Step 3 animation: highlight 2 player + 3 community cards ─────────────

function Step3Visual() {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.sequence([
      Animated.timing(pulse, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]);
    // Finite repeat — iron rule: no withRepeat(-1)
    const seq = Animated.loop(loop, { iterations: 4 });
    seq.start();
    return () => seq.stop();
  }, []);

  const cards = ['A♠', 'K♥', '—', 'Q♦', 'J♣', '—', '10♠', 'A♥'];
  const highlighted = [0, 1, 3, 4, 7]; // player[0,1] + community[0,1,2]

  return (
    <View style={vis.omahaRow}>
      {cards.map((c, i) => {
        if (c === '—') return <Text key={i} style={vis.plus}>+</Text>;
        const isHighlighted = highlighted.includes(i);
        return (
          <Animated.View key={i} style={[vis.miniCard, isHighlighted && { opacity: pulse }]}>
            <Text style={[vis.miniCardText, isHighlighted && vis.miniCardHighlight]}>{c}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

// ─── Step 4 animation: COMPLETE badge scale bounce ────────────────────────

function Step4Visual() {
  const scale = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
    return () => { scale.stopAnimation(); glow.stopAnimation(); };
  }, []);

  return (
    <View style={vis.completeWrap}>
      <View style={vis.boardsMiniRow}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={vis.boardMini}>
            <Text style={vis.boardMiniWin}>WIN</Text>
          </View>
        ))}
      </View>
      <Animated.View style={[vis.completeBadge, { transform: [{ scale }], opacity: glow }]}>
        <Text style={vis.completeBadgeText}>🏆 COMPLETE +50%</Text>
      </Animated.View>
    </View>
  );
}

// ─── Step 5: avatar + CTA ─────────────────────────────────────────────────

function Step5Visual() {
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }).start();
    return () => scale.stopAnimation();
  }, []);

  return (
    <Animated.View style={[vis.avatarWrap, { transform: [{ scale }] }]}>
      <Text style={vis.avatarEmoji}>🎰</Text>
      <Text style={vis.avatarLabel}>YOU</Text>
    </Animated.View>
  );
}

// ─── Main Tutorial component ───────────────────────────────────────────────

interface TutorialProps {
  onDone: () => void;
}

export default function Tutorial({ onDone }: TutorialProps) {
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const rtl = isRTL();
  const tx = t();

  const STEPS = [
    { title: tx.onboarding.step1Title, body: tx.onboarding.step1Body, Visual: Step1Visual },
    { title: tx.onboarding.step2Title, body: tx.onboarding.step2Body, Visual: Step2Visual },
    { title: tx.onboarding.step3Title, body: tx.onboarding.step3Body, Visual: Step3Visual },
    { title: tx.onboarding.step4Title, body: tx.onboarding.step4Body, Visual: Step4Visual },
    { title: tx.onboarding.step5Title, body: tx.onboarding.step5Body, Visual: Step5Visual },
  ];

  const goToStep = (nextStep: number) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setStep(nextStep);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) {
      goToStep(step + 1);
    } else {
      AsyncStorage.setItem(TUTORIAL_SEEN_KEY, 'true').catch(() => {});
      onDone();
    }
  };

  const handleSkip = () => {
    AsyncStorage.setItem(TUTORIAL_SEEN_KEY, 'true').catch(() => {});
    onDone();
  };

  const current = STEPS[step];
  const isLast = step === TOTAL_STEPS - 1;
  const Visual = current.Visual;

  return (
    <View style={styles.overlay}>
      {/* SKIP button */}
      <Pressable
        style={[styles.skipBtn, rtl ? styles.skipBtnLeft : styles.skipBtnRight]}
        onPress={handleSkip}
        hitSlop={12}
      >
        <Text style={styles.skipText}>{tx.onboarding.skip}</Text>
      </Pressable>

      <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
        {/* Visual animation */}
        <View style={styles.visualArea}>
          <Visual />
        </View>

        {/* Title */}
        <Text style={[styles.title, rtl && styles.textRTL]}>{current.title}</Text>

        {/* Body */}
        <Text style={[styles.body, rtl && styles.textRTL]}>{current.body}</Text>

        {/* Progress dots */}
        <View style={styles.dots}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <Pressable key={i} onPress={() => goToStep(i)} hitSlop={8}>
              <View style={[styles.dot, i === step && styles.dotActive]} />
            </Pressable>
          ))}
        </View>

        {/* CTA button */}
        <Pressable
          style={[styles.btn, isLast && styles.btnLast]}
          onPress={handleNext}
        >
          <Text style={styles.btnText}>
            {isLast ? tx.onboarding.letsPlay : tx.onboarding.next}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 500,
    padding: rs(24),
  },
  skipBtn: {
    position: 'absolute',
    top: rs(52),
    padding: rs(10),
    zIndex: 10,
  },
  skipBtnRight: {
    right: rs(24),
  },
  skipBtnLeft: {
    left: rs(24),
  },
  skipText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: rf(13),
    fontWeight: '600',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: rv(20),
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    padding: rs(24),
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    gap: rs(12),
    ...Platform.select({
      ios: { shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 20 },
      android: { elevation: 12 },
      default: { boxShadow: `0 0 30px rgba(201,168,76,0.35)` } as any,
    }),
  },
  visualArea: {
    width: '100%',
    minHeight: rs(80),
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: COLORS.goldBright,
    fontSize: rf(20),
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  body: {
    color: COLORS.textPrimary,
    fontSize: rf(14),
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: rf(21),
    opacity: 0.9,
  },
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  } as any,
  dots: {
    flexDirection: 'row',
    gap: rs(8),
    marginTop: rs(4),
  },
  dot: {
    width: rv(8),
    height: rv(8),
    borderRadius: rv(4),
    backgroundColor: COLORS.boardBorder,
  },
  dotActive: {
    backgroundColor: COLORS.gold,
    width: rv(20),
    borderRadius: rv(4),
  },
  btn: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: rs(32),
    paddingVertical: rs(14),
    borderRadius: rv(14),
    marginTop: rs(4),
    width: '100%',
    alignItems: 'center',
  },
  btnLast: {
    backgroundColor: '#4CAF50',
  },
  btnText: {
    color: '#0a0a0a',
    fontSize: rf(16),
    fontWeight: '900',
    letterSpacing: 1,
  },
});

// ─── Visual sub-styles ─────────────────────────────────────────────────────

const vis = StyleSheet.create({
  boardRow: {
    flexDirection: 'row',
    gap: rs(12),
    justifyContent: 'center',
  },
  boardBox: {
    width: rs(52),
    height: rs(52),
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    borderRadius: rv(8),
    justifyContent: 'center',
    alignItems: 'center',
  },
  boardBoxLabel: {
    color: COLORS.gold,
    fontSize: rf(14),
    fontWeight: '800',
  },
  cardFlyRow: {
    flexDirection: 'row',
    gap: rs(14),
    justifyContent: 'center',
  },
  flyCard: {
    width: rs(48),
    height: rs(64),
    backgroundColor: '#fff',
    borderRadius: rv(6),
    justifyContent: 'center',
    alignItems: 'center',
    gap: rs(2),
  },
  flyCardText: {
    fontSize: rf(20),
  },
  flyCardNum: {
    fontSize: rf(10),
    fontWeight: '700',
    color: '#333',
  },
  omahaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(4),
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  miniCard: {
    width: rs(32),
    height: rs(44),
    backgroundColor: '#fff',
    borderRadius: rv(4),
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniCardText: {
    fontSize: rf(9),
    fontWeight: '700',
    color: '#333',
  },
  miniCardHighlight: {
    color: '#c00',
  },
  plus: {
    color: COLORS.gold,
    fontSize: rf(16),
    fontWeight: '900',
  },
  completeWrap: {
    alignItems: 'center',
    gap: rs(12),
  },
  boardsMiniRow: {
    flexDirection: 'row',
    gap: rs(8),
  },
  boardMini: {
    width: rs(44),
    height: rs(44),
    backgroundColor: 'rgba(76,175,80,0.2)',
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: rv(6),
    justifyContent: 'center',
    alignItems: 'center',
  },
  boardMiniWin: {
    color: '#4CAF50',
    fontSize: rf(9),
    fontWeight: '800',
    letterSpacing: 1,
  },
  completeBadge: {
    backgroundColor: 'rgba(201,168,76,0.2)',
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    paddingHorizontal: rs(20),
    paddingVertical: rs(10),
    borderRadius: rv(12),
  },
  completeBadgeText: {
    color: COLORS.goldBright,
    fontSize: rf(16),
    fontWeight: '900',
    letterSpacing: 1,
  },
  avatarWrap: {
    alignItems: 'center',
    gap: rs(8),
  },
  avatarEmoji: {
    fontSize: rf(56),
  },
  avatarLabel: {
    color: COLORS.goldLight,
    fontSize: rf(14),
    fontWeight: '800',
    letterSpacing: 3,
  },
});
