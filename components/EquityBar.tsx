/**
 * BX2 / BP3 — the equity bar.
 *
 * Two hues side by side is the single case that dies without colour, so per the spec's
 * BP3 section hue is the LAST channel here, never the only one. Four channels carry the
 * same fact:
 *   POSITION — the leader's figure is always on the left. Order is the information.
 *   TEXT     — an explicit LEADING / TRAILING label under each figure.
 *   LENGTH   — segment width, non-hue by nature.
 *   TEXTURE  — the player's segment is solid, the opponents' segment is 45 degree hatch.
 *              Texture survives greyscale; a hue swap does not.
 * Plus a 2px high-contrast divider at the split, so the boundary is still findable when
 * both segments render as the same grey.
 *
 * The delta chip leads with a triangle glyph and MOVES in the direction of the change,
 * because "+18% green" and "-22% red" are the same chip to a colourblind player and the
 * sign character is easy to miss at 12px.
 *
 * Iron Rule #3: every dimension goes through rs()/rf() WITH screenW passed, because a
 * bare rs() freezes at module scope on web and would not respond to 375 vs 393.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { rf, rs } from '../utils/responsive';

interface Props {
  selfPct: number;
  oppPct: number;
  /** Previous street's self%, so the bar can animate the CHANGE rather than just land on a number. */
  prevSelfPct?: number | null;
  screenW: number;
  /** Null until the exact enumeration resolves — renders a skeleton, never a wrong number. */
  pending?: boolean;
}

const HATCH_STRIPES = 14;

export function EquityBar({ selfPct, oppPct, prevSelfPct, screenW, pending }: Props) {
  const fill = useRef(new Animated.Value(prevSelfPct ?? selfPct)).current;
  const chipY = useRef(new Animated.Value(0)).current;
  const chipOpacity = useRef(new Animated.Value(0)).current;

  const delta = prevSelfPct == null ? 0 : selfPct - prevSelfPct;
  const hasDelta = Math.abs(delta) >= 1;

  useEffect(() => {
    if (pending) return;
    const a = Animated.timing(fill, {
      toValue: selfPct,
      duration: prevSelfPct == null ? 400 : 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // width % — cannot be native-driven
    });
    a.start();
    if (hasDelta) {
      // Direction of motion is itself a channel: rises on a gain, falls on a loss.
      chipY.setValue(0);
      chipOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(chipY, {
          toValue: delta > 0 ? -12 : 12,
          duration: 900,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(chipOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
          Animated.delay(400),
          Animated.timing(chipOpacity, { toValue: 0, duration: 320, useNativeDriver: true }),
        ]),
      ]).start();
    }
    return () => a.stop();
  }, [selfPct, pending]);

  const playerLeads = selfPct >= oppPct;

  // POSITION CHANNEL — the leader is always rendered first (left).
  const left = playerLeads
    ? { pct: selfPct, label: 'LEADING', who: 'YOU', tid: 'equity-value-self' }
    : { pct: oppPct, label: 'LEADING', who: 'OPP', tid: 'equity-value-opponent' };
  const right = playerLeads
    ? { pct: oppPct, label: 'TRAILING', who: 'OPP', tid: 'equity-value-opponent' }
    : { pct: selfPct, label: 'TRAILING', who: 'YOU', tid: 'equity-value-self' };

  const barH = rs(14, screenW);

  return (
    <View style={styles.wrap} testID="equity-bar" accessibilityLiveRegion="polite"
      accessibilityLabel={pending ? 'Calculating odds' : `You ${selfPct} percent, opponent ${oppPct} percent`}>

      <View style={styles.figureRow}>
        {[left, right].map((side, i) => (
          <View key={i} style={[styles.figureCol, i === 1 && styles.figureColRight]}>
            <Text testID={side.tid} style={[styles.pct, { fontSize: rf(20, undefined, undefined, screenW) }]}>
              {pending ? '––' : `${side.pct}%`}
            </Text>
            <Text style={[styles.standing, { fontSize: rf(11, undefined, undefined, screenW) }]}>
              {side.who} · {side.label}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.track, { height: barH, borderRadius: barH / 2 }]}>
        {/* Player segment — SOLID fill. */}
        <Animated.View
          style={[
            styles.selfFill,
            {
              width: fill.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
              borderRadius: barH / 2,
            },
          ]}
        />
        {/* Opponent segment — 45 degree HATCH. Drawn as rotated stripes so it works on
            native and web alike; a CSS repeating-linear-gradient would be web-only. */}
        <Animated.View
          style={[
            styles.hatchClip,
            // Anchored to the split, so the hatch marks the OPPONENT'S segment only. Left as a
            // plain full-width overlay it would sit on top of the solid fill too and both
            // segments would read identically - which is the exact failure this is here to fix.
            { left: fill.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) },
          ]}
          pointerEvents="none"
        >
          {Array.from({ length: HATCH_STRIPES }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.stripe,
                { left: `${(i / HATCH_STRIPES) * 100}%`, height: barH * 3, width: rs(3, screenW) },
              ]}
            />
          ))}
        </Animated.View>
        {/* 2px divider at the split — the boundary must survive full hue removal. */}
        <Animated.View
          style={[
            styles.divider,
            { width: rs(2, screenW), left: fill.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) },
          ]}
        />
      </View>

      {hasDelta && !pending && (
        <Animated.View
          testID="delta-chip"
          style={[styles.chip, { opacity: chipOpacity, transform: [{ translateY: chipY }] }]}
        >
          <Text style={[styles.chipText, { fontSize: rf(13, undefined, undefined, screenW) }]}>
            {delta > 0 ? '▲' : '▼'} {delta > 0 ? '+' : ''}{delta}%
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'stretch' },
  figureRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 4 },
  figureCol: { alignItems: 'flex-start' },
  figureColRight: { alignItems: 'flex-end' },
  pct: { color: '#FFFFFF', fontWeight: '800', fontVariant: ['tabular-nums'] },
  standing: { color: 'rgba(255,255,255,0.72)', fontWeight: '700', letterSpacing: 0.8 },
  track: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
    position: 'relative',
  },
  selfFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#4FD6A8' },
  hatchClip: { position: 'absolute', right: 0, top: 0, bottom: 0, overflow: 'hidden' },
  stripe: {
    position: 'absolute',
    top: -8,
    backgroundColor: 'rgba(255,255,255,0.30)',
    transform: [{ rotate: '45deg' }],
  },
  divider: { position: 'absolute', top: 0, bottom: 0, backgroundColor: '#FFFFFF' },
  chip: { alignSelf: 'center', marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  chipText: { color: '#FFFFFF', fontWeight: '800', fontVariant: ['tabular-nums'] },
});

export default EquityBar;
