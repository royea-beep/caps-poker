/**
 * HomeCupRings — the marks a night of play leaves on a table.
 *
 * CAPS reads as CUPS, and the game came off a real table that Roye's friends invented. A cup
 * set down leaves a ring. Over an evening a table collects them. That is the whole idea: the
 * home screen is not decorated, it is *used* — the residue of games already played, which is
 * the one thing about CAPS nobody else can claim.
 *
 * Chosen over four alternatives because it is the only one that is ambient by nature rather
 * than by tuning. Rings appear, sit, and fade; they do not cycle, pulse or travel, so it cannot
 * read as a loading state — the failure mode every other concept had to design around.
 *
 * MEASURED BASELINE, 2026-08-13, live, both engines at 375 and 393 (assertAnimatable first,
 * transform sampled — not opacity):
 *   - Home already moves: 16 elements, the HeroParticles suit field drifting ~108px/s.
 *   - It renders at opacity 0.030-0.055, i.e. it costs frames and is invisible. This component
 *     deliberately sits ABOVE that floor (peak 0.13) so that something is actually perceptible.
 *   - Local cadence is ~32fps on Chromium, ~66 on WebKit. Budget is measured against 32.
 *
 * WHY RN Animated AND NOT REANIMATED. Two hard constraints from MEMORY.md: a screen may hold at
 * most 5 Reanimated shared values, and `withRepeat(-1)` crashes Hermes. Home already spends its
 * budget on HeroParticles/HeroGlow. RN's Animated.loop with a FINITE `iterations` is the pattern
 * already proven in app/battle-pass.tsx (TierCircle) and it sidesteps both limits. It also runs
 * on the native driver, so the work leaves the JS thread entirely.
 *
 * The loop is finite on purpose (RING_LOOPS). After ~7 minutes the rings stop. Nobody sits on a
 * home screen that long, and a finite loop cannot leak a timer into a backgrounded app.
 *
 * Iron Rule #3: every dimension derives from the live window width via rs(). Nothing is a
 * literal pixel, and screenW comes from useWindowDimensions because rs() freezes at module
 * scope on web.
 *
 * Contains no reference to anything outside this project. A ring on a table is not a property.
 */

import React from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';

/** One ring's full life: fade up, sit, fade out. */
const RING_MS = 9000;
/** Stagger so the three never breathe together — a table collects rings, it does not pulse. */
const RING_STAGGER_MS = 3000;
/** Finite by necessity (no withRepeat(-1)); ~7 minutes of ambience is far past any real dwell. */
const RING_LOOPS = 45;
/** Peak opacity. The existing suit field sits at 0.03-0.055 and is invisible; this clears it. */
const RING_PEAK = 0.13;

interface RingSpec {
  /** Fractions of the screen box, so placement scales instead of being pinned to a device. */
  xPct: number;
  yPct: number;
  sizePct: number;
}

/** Placed off the vertical centre band where PLAY lives, so nothing ever sits behind the CTA. */
const RINGS: readonly RingSpec[] = [
  { xPct: 0.12, yPct: 0.14, sizePct: 0.30 },
  { xPct: 0.68, yPct: 0.70, sizePct: 0.38 },
  { xPct: 0.30, yPct: 0.86, sizePct: 0.24 },
];

function Ring({ spec, index, screenW, screenH }: { spec: RingSpec; index: number; screenW: number; screenH: number }) {
  const t = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(index * RING_STAGGER_MS),
        Animated.timing(t, { toValue: 1, duration: RING_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
      { iterations: RING_LOOPS },
    );
    loop.start();
    return () => {
      loop.stop();
      t.setValue(0);
    };
  }, [index]);

  const size = Math.round(screenW * spec.sizePct);

  // A ring darkens the felt as the cup sits, then dries. Never fully opaque, never absent long.
  const opacity = t.interpolate({ inputRange: [0, 0.25, 0.6, 1], outputRange: [0, RING_PEAK, RING_PEAK * 0.8, 0] });
  // A drying ring spreads very slightly. 8% over nine seconds reads as settling, not zooming.
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.02] });

  return (
    <Animated.View
      testID="cup-ring"
      pointerEvents="none"
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: Math.max(1, Math.round(size * 0.012)),
          left: Math.round(screenW * spec.xPct),
          top: Math.round(screenH * spec.yPct),
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
}

export function HomeCupRings() {
  const { width: screenW, height: screenH } = useWindowDimensions();

  // rs() would freeze at import on web; a zero width would place every ring at the origin.
  if (!screenW || screenW <= 0) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="cup-rings-layer">
      {RINGS.map((spec, i) => (
        <Ring key={i} spec={spec} index={i} screenW={screenW} screenH={screenH} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    // Warm off-white at low alpha — the colour of a wet rim on dark felt. Carries no meaning by
    // hue alone; it is texture, and it is legible purely as a change in luminance.
    borderColor: 'rgba(255, 248, 231, 0.55)',
    backgroundColor: 'transparent',
  },
});

export default HomeCupRings;
