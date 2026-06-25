/**
 * InteractiveTutorial — S98
 * 3-step interactive tutorial with real Card components. ZERO Reanimated.
 * Replaces 5-slide static Tutorial for first-launch.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../constants/gameConfig';
import type { Card as CardType } from '../constants/gameConfig';
import { rf, rs, rv } from '../utils/responsive';
import { t, isRTL, getLanguage } from '../utils/i18n';
import { track } from '../utils/analytics';
import CardComponent from './Card';

export const INTERACTIVE_TUTORIAL_KEY = 'has_seen_interactive_tutorial';

const PLAYER_CARDS: CardType[] = [
  { suit: 'spades', rank: 'A', id: 'tut_p1' },
  { suit: 'hearts', rank: 'K', id: 'tut_p2' },
  { suit: 'diamonds', rank: 'Q', id: 'tut_p3' },
  { suit: 'clubs', rank: 'J', id: 'tut_p4' },
];

const COMMUNITY_CARDS: CardType[] = [
  { suit: 'spades', rank: '10', id: 'tut_c1' },
  { suit: 'hearts', rank: 'A', id: 'tut_c2' },
  { suit: 'diamonds', rank: 'K', id: 'tut_c3' },
  { suit: 'clubs', rank: '9', id: 'tut_c4' },
  { suit: 'spades', rank: '7', id: 'tut_c5' },
];

// ─── Step 1: 4 player cards fly in ────────────────────────────────────────────

function Step1Visual() {
  const opacities = PLAYER_CARDS.map(() => useRef(new Animated.Value(0)).current);
  const translateYs = PLAYER_CARDS.map(() => useRef(new Animated.Value(-36)).current);

  useEffect(() => {
    const anims = PLAYER_CARDS.map((_, i) =>
      Animated.parallel([
        Animated.timing(opacities[i], {
          toValue: 1,
          duration: 280,
          delay: i * 160,
          useNativeDriver: true,
        }),
        Animated.timing(translateYs[i], {
          toValue: 0,
          duration: 320,
          delay: i * 160,
          useNativeDriver: true,
        }),
      ])
    );
    const seq = Animated.stagger(160, anims);
    seq.start();
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={vis.cardRow}>
      {PLAYER_CARDS.map((card, i) => (
        <Animated.View
          key={card.id}
          style={{ opacity: opacities[i], transform: [{ translateY: translateYs[i] }] }}
        >
          <CardComponent
            card={card}
            faceDown={false}
            cardWidth={rs(48)}
            cardHeight={rs(68)}
          />
        </Animated.View>
      ))}
    </View>
  );
}

// ─── Step 2: interactive — player taps a card to "place" it ──────────────────

interface Step2VisualProps {
  onCardPlace: () => void;
}

function Step2Visual({ onCardPlace }: Step2VisualProps) {
  const [placedIdx, setPlacedIdx] = useState<number | null>(null);
  const checkScale = useRef(new Animated.Value(0)).current;

  const isHE = getLanguage() === 'he';

  const handleCardTap = (idx: number) => {
    if (placedIdx !== null) return; // already placed
    setPlacedIdx(idx);
    onCardPlace();
    Animated.spring(checkScale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }).start();
    track('tutorial_step2_card_placed', { cardIndex: idx });
  };

  return (
    <View style={vis.step2Wrap}>
      {/* Player cards — tap to place */}
      <View style={vis.cardGroup}>
        <Text style={vis.groupLabel}>{isHE ? 'לחץ קלף!' : 'TAP A CARD!'}</Text>
        <View style={vis.cardRow}>
          {PLAYER_CARDS.slice(0, 2).map((card, i) => (
            <TouchableOpacity key={card.id} onPress={() => handleCardTap(i)} activeOpacity={0.75}>
              <CardComponent
                card={card}
                faceDown={false}
                highlighted={placedIdx === i}
                dimmed={placedIdx !== null && placedIdx !== i}
                cardWidth={rs(40)}
                cardHeight={rs(56)}
              />
            </TouchableOpacity>
          ))}
        </View>
        {placedIdx !== null && (
          <Animated.Text style={[vis.placedCheck, { transform: [{ scale: checkScale }] }]}>
            {isHE ? '✓ מושלם!' : '✓ Perfect!'}
          </Animated.Text>
        )}
      </View>

      <Text style={vis.plus}>+</Text>

      {/* Community cards — always shown */}
      <View style={vis.cardGroup}>
        <Text style={vis.groupLabel}>{isHE ? 'קהילה' : 'COMMUNITY'}</Text>
        <View style={vis.cardRow}>
          {COMMUNITY_CARDS.slice(0, 3).map((card) => (
            <CardComponent
              key={card.id}
              card={card}
              faceDown={false}
              highlighted
              isCommunityCard
              cardWidth={rs(36)}
              cardHeight={rs(50)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Step 3: 4 boards light up → COMPLETE ────────────────────────────────────

function Step3Visual() {
  const boardLit = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];
  const badgeScale = useRef(new Animated.Value(0)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const boardAnims = boardLit.map((val, i) =>
      Animated.timing(val, { toValue: 1, duration: 400, delay: i * 600, useNativeDriver: true })
    );
    Animated.sequence([
      Animated.stagger(600, boardAnims),
      Animated.parallel([
        Animated.spring(badgeScale, { toValue: 1, friction: 4, tension: 90, useNativeDriver: true }),
        Animated.timing(badgeOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();
    return () => {
      boardAnims.forEach(a => a.stop());
      badgeScale.stopAnimation();
      badgeOpacity.stopAnimation();
    };
  }, []);

  return (
    <View style={vis.step3Wrap}>
      <View style={vis.boardsRow}>
        {boardLit.map((litVal, i) => {
          const bgColor = litVal.interpolate({
            inputRange: [0, 1],
            outputRange: ['rgba(30,10,5,0.8)', 'rgba(76,175,80,0.25)'],
          });
          const borderColor = litVal.interpolate({
            inputRange: [0, 1],
            outputRange: ['rgba(255,255,255,0.12)', '#4CAF50'],
          });
          return (
            <Animated.View
              key={i}
              style={[vis.boardBox, { backgroundColor: bgColor, borderColor }]}
            >
              <Animated.Text style={[vis.boardWin, { opacity: litVal }]}>WIN</Animated.Text>
            </Animated.View>
          );
        })}
      </View>
      <Animated.View
        style={[
          vis.completeBadge,
          { transform: [{ scale: badgeScale }], opacity: badgeOpacity },
        ]}
      >
        <Text style={vis.completeBadgeText}>🏆 COMPLETE +50%</Text>
      </Animated.View>
    </View>
  );
}

// ─── Main InteractiveTutorial ─────────────────────────────────────────────────

interface InteractiveTutorialProps {
  onDone: () => void;
}

const TOTAL_STEPS = 3;

function InteractiveTutorialImpl({ onDone }: InteractiveTutorialProps) {
  const [step, setStep] = useState(0);
  const [step2CardPlaced, setStep2CardPlaced] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const rtl = isRTL();
  const tx = t();
  const isHE = getLanguage() === 'he';

  const STEPS = [
    {
      title: isHE ? 'יש לך 4 קלפים בכל בורד' : 'You have 4 cards per board',
      body: isHE
        ? 'ב-Caps Poker קיבלת 4 קלפי יד לכל בורד — לא 2 כמו ב-Hold\'em!'
        : 'In Caps Poker you get 4 hole cards per board — not 2 like Hold\'em!',
      Visual: () => <Step1Visual />,
    },
    {
      title: isHE ? 'לחץ קלף כדי לשחק!' : 'Tap a card to place it!',
      body: isHE
        ? 'חייב להשתמש בדיוק ב-2 קלפים שלך ו-3 קלפי קהילה — כלל Omaha!'
        : 'Use exactly 2 of your cards + 3 community cards — Omaha rule!',
      Visual: () => <Step2Visual onCardPlace={() => setStep2CardPlaced(true)} />,
    },
    {
      title: isHE ? 'נצח בכל הבורדים = COMPLETE' : 'Win ALL boards = COMPLETE',
      body: isHE
        ? 'נצח בכל 4 הבורדים וקבל בונוס +50% על הסיר!'
        : 'Win all boards and get a +50% pot bonus!',
      Visual: () => <Step3Visual />,
    },
  ];

  const goToStep = (next: number) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 130, useNativeDriver: true }).start(() => {
      setStep(next);
      setStep2CardPlaced(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  };

  const handleNext = () => {
    track(`tutorial_step_${step + 1}_completed`, {});
    if (step < TOTAL_STEPS - 1) {
      goToStep(step + 1);
    } else {
      AsyncStorage.setItem(INTERACTIVE_TUTORIAL_KEY, 'true').catch(() => {});
      // DEDUPE-QA: this is now the single onboarding — emit the funnel-completion events that
      // used to come from the separate OnboardingOverlay / WelcomeModal flows.
      track('tutorial_completed', {}, 'onboarding');
      track('onboarding_completed', {}, 'onboarding');
      onDone();
    }
  };

  const handleSkip = () => {
    track('tutorial_skipped', { at_step: step + 1 });
    track('onboarding_skipped', { at_step: step + 1 }, 'onboarding');
    AsyncStorage.setItem(INTERACTIVE_TUTORIAL_KEY, 'true').catch(() => {});
    onDone();
  };

  const current = STEPS[step];
  const isLast = step === TOTAL_STEPS - 1;
  const Visual = current.Visual;
  const nextDisabled = step === 1 && !step2CardPlaced;

  return (
    <View style={styles.overlay}>
      <Pressable
        style={[styles.skipBtn, rtl ? styles.skipBtnLeft : styles.skipBtnRight]}
        onPress={handleSkip}
        hitSlop={12}
      >
        <Text style={styles.skipText}>{tx.onboarding?.skip ?? (isHE ? 'דלג' : 'Skip')}</Text>
      </Pressable>

      <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
        <View style={styles.visualArea}>
          <Visual />
        </View>

        <Text style={[styles.title, rtl && styles.textRTL]}>{current.title}</Text>
        <Text style={[styles.body, rtl && styles.textRTL]}>{current.body}</Text>

        {/* Progress dots */}
        <View style={styles.dots}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <Pressable key={i} onPress={() => goToStep(i)} hitSlop={8}>
              <View style={[styles.dot, i === step && styles.dotActive]} />
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[styles.btn, isLast && styles.btnLast, nextDisabled && styles.btnDisabled]}
          onPress={nextDisabled ? undefined : handleNext}
        >
          <Text style={[styles.btnText, nextDisabled && styles.btnTextDisabled]}>
            {isLast
              ? (tx.onboarding?.letsPlay ?? (isHE ? 'בואו נשחק!' : "Let's play!"))
              : nextDisabled
              ? (isHE ? 'לחץ קלף ↑' : 'Tap a card ↑')
              : (tx.onboarding?.next ?? (isHE ? 'הבא' : 'Next'))}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.93)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 500,
    padding: rs(20),
  },
  skipBtn: {
    position: 'absolute',
    top: rs(52),
    padding: rs(10),
    zIndex: 10,
  },
  skipBtnRight: { right: rs(24) },
  skipBtnLeft: { left: rs(24) },
  skipText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: rf(13),
    fontWeight: '600',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: '#140a0d',
    borderRadius: rv(20),
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    padding: rs(22),
    alignItems: 'center',
    width: '100%',
    maxWidth: 390,
    gap: rs(10),
    ...Platform.select({
      ios: { shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 20 },
      android: { elevation: 12 },
      default: { boxShadow: '0 0 30px rgba(201,168,76,0.35)' } as any,
    }),
  },
  visualArea: {
    width: '100%',
    minHeight: rs(90),
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: COLORS.goldBright,
    fontSize: rf(18),
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  body: {
    color: COLORS.textPrimary,
    fontSize: rf(13),
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: rf(19),
    opacity: 0.85,
  },
  textRTL: { textAlign: 'right', writingDirection: 'rtl' } as any,
  dots: { flexDirection: 'row', gap: rs(8), marginTop: rs(2) },
  dot: {
    width: rv(8),
    height: rv(8),
    borderRadius: rv(4),
    backgroundColor: COLORS.boardBorder,
  },
  dotActive: {
    backgroundColor: COLORS.gold,
    width: rv(22),
    borderRadius: rv(4),
  },
  btn: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: rs(32),
    paddingVertical: rs(13),
    borderRadius: rv(14),
    marginTop: rs(2),
    width: '100%',
    alignItems: 'center',
  },
  btnLast: { backgroundColor: '#4CAF50' },
  btnDisabled: { backgroundColor: 'rgba(201,168,76,0.25)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.4)' },
  btnText: { color: '#0a0a0a', fontSize: rf(15), fontWeight: '900', letterSpacing: 1 },
  btnTextDisabled: { color: 'rgba(201,168,76,0.7)' },
});

const vis = StyleSheet.create({
  cardRow: {
    flexDirection: 'row',
    gap: rs(8),
    justifyContent: 'center',
    alignItems: 'center',
  },
  step2Wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(8),
  },
  cardGroup: {
    alignItems: 'center',
    gap: rs(4),
  },
  groupLabel: {
    color: COLORS.gold,
    fontSize: rf(8),
    fontWeight: '800',
    letterSpacing: 1.5,
    opacity: 0.85,
  },
  placedCheck: {
    color: '#4CAF50',
    fontSize: rf(13),
    fontWeight: '800',
    marginTop: rs(4),
    textAlign: 'center',
  },
  plus: {
    color: COLORS.gold,
    fontSize: rf(20),
    fontWeight: '900',
    marginHorizontal: rs(2),
    marginTop: rs(14),
  },
  step3Wrap: {
    alignItems: 'center',
    gap: rs(14),
  },
  boardsRow: {
    flexDirection: 'row',
    gap: rs(8),
  },
  boardBox: {
    width: rs(50),
    height: rs(50),
    borderWidth: 1.5,
    borderRadius: rv(8),
    justifyContent: 'center',
    alignItems: 'center',
  },
  boardWin: {
    color: '#4CAF50',
    fontSize: rf(9),
    fontWeight: '900',
    letterSpacing: 1,
  },
  completeBadge: {
    backgroundColor: 'rgba(201,168,76,0.18)',
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
});


// PR (sim CI guards): when EXPO_PUBLIC_CAPS_CI === '1' we render a tiny shim that
// fires onDone immediately and renders nothing. Keeps Rules-of-Hooks clean - the
// real component (InteractiveTutorialImpl) is never mounted in CI mode, so its
// hook order is irrelevant. Real users (no CI flag) get the full tutorial.
function InteractiveTutorialCISkip({ onDone }: InteractiveTutorialProps) {
  useEffect(() => {
    AsyncStorage.setItem(INTERACTIVE_TUTORIAL_KEY, 'true').catch(() => {});
    onDone();
  }, []);
  return null;
}
const CAPS_CI_MODE = process.env.EXPO_PUBLIC_CAPS_CI === '1';
export default function InteractiveTutorial(props: InteractiveTutorialProps) {
  if (CAPS_CI_MODE) return <InteractiveTutorialCISkip {...props} />;
  return <InteractiveTutorialImpl {...props} />;
}
