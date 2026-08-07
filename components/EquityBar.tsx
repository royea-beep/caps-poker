/**
 * BX2 / BY1 — the equity display.
 *
 * TWO LAYOUTS, chosen by seat count, because one layout cannot serve both:
 *
 *   2 seats  → a single split bar. The POSITION channel works here: leader left, trailing
 *              right, one 2px divider at the split. This is the verified BX2 layout and is
 *              deliberately unchanged.
 *   3-4 seats → STACKED LABELLED ROWS, sorted leader-first. BP3 says it outright: "never
 *              encode a third seat by hue alone; at 3-4 players use stacked labelled rows,
 *              not a three-colour bar." A four-segment bar on a 375px screen is four
 *              adjacent hues with no room for a number inside any of them - unreadable for
 *              everyone, not only for colourblind players.
 *
 * Non-colour channels survive the seat count going up, and there are MORE of them, not fewer:
 *   POSITION — rows sorted by equity, leader on top. Order is the information.
 *   ORDINAL  — an explicit 1./2./3./4. per row. Hue-free, and it still reads at a glance
 *              when four bars are all mid-grey.
 *   NAME     — YOU vs BOT n, so your row is findable without colour.
 *   TEXT     — LEADING on the top row.
 *   LENGTH   — bar width per row.
 *   TEXTURE  — your bar solid, opponents' hatched at 45 degrees.
 *
 * Iron Rule #3: every dimension goes through rs()/rf() WITH screenW passed. A bare rs()
 * freezes at module scope on web and would not respond to 375 vs 393.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { rf, rs } from '../utils/responsive';
import { SeatEquity } from '../utils/revealEquity';

interface Props {
  seats: SeatEquity[];
  /** Previous street's share for YOU, so the delta chip can show the change. */
  prevSelfPct?: number | null;
  screenW: number;
  pending?: boolean;
  seatLabel?: (seat: number) => string;
}

const HATCH_STRIPES = 14;

function Hatch({ barH, screenW }: { barH: number; screenW: number }) {
  return (
    <>
      {Array.from({ length: HATCH_STRIPES }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.stripe,
            { left: `${(i / HATCH_STRIPES) * 100}%`, height: barH * 3, width: rs(3, screenW) },
          ]}
        />
      ))}
    </>
  );
}

export function EquityBar({ seats, prevSelfPct, screenW, pending, seatLabel }: Props) {
  const self = seats.find((s) => s.isSelf);
  const selfPct = self ? self.pct : 50;

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
        Animated.timing(chipY, { toValue: delta > 0 ? -12 : 12, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(chipOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
          Animated.delay(500),
          Animated.timing(chipOpacity, { toValue: 0, duration: 320, useNativeDriver: true }),
        ]),
      ]).start();
    }
    return () => a.stop();
  }, [selfPct, pending]);

  const label = (s: SeatEquity) => (s.isSelf ? 'YOU' : seatLabel ? seatLabel(s.seat) : `BOT ${s.seat}`);
  const barH = rs(14, screenW);
  const multi = seats.length > 2;

  const deltaChip = hasDelta && !pending ? (
    <Animated.View testID="delta-chip" style={[styles.chip, { opacity: chipOpacity, transform: [{ translateY: chipY }] }]}>
      <Text style={[styles.chipText, { fontSize: rf(13, undefined, undefined, screenW) }]}>
        {delta > 0 ? '▲' : '▼'} {delta > 0 ? '+' : ''}{delta}%
      </Text>
    </Animated.View>
  ) : null;

  // ── 3-4 SEATS — stacked rows ──────────────────────────────────────────────────────
  if (multi) {
    const ordered = [...seats].sort((a, b) => b.raw - a.raw || a.seat - b.seat);
    const rowH = rs(15, screenW);
    return (
      <View style={styles.wrap} testID="equity-bar" accessibilityLiveRegion="polite"
        accessibilityLabel={pending ? 'Calculating odds' : ordered.map((s) => `${label(s)} ${s.pct} percent`).join(', ')}>
        {ordered.map((s, i) => (
          <View key={s.seat} style={[styles.seatRow, { marginBottom: rs(3, screenW) }]}>
            <Text style={[styles.ordinal, { fontSize: rf(11, undefined, undefined, screenW), width: rs(13, screenW) }]}>{i + 1}.</Text>
            <Text
              numberOfLines={1}
              style={[styles.seatName, s.isSelf && styles.seatNameSelf, { fontSize: rf(11, undefined, undefined, screenW), width: rs(40, screenW) }]}
            >
              {label(s)}
            </Text>
            <View style={[styles.seatTrack, { height: rowH, borderRadius: rowH / 2 }]}>
              <View style={[styles.seatFill, { width: `${s.pct}%`, borderRadius: rowH / 2, backgroundColor: s.isSelf ? '#4FD6A8' : 'rgba(255,255,255,0.34)' }]}>
                {!s.isSelf && <Hatch barH={rowH} screenW={screenW} />}
              </View>
            </View>
            <Text
              testID={`equity-value-seat-${s.seat}`}
              style={[styles.seatPct, s.isSelf && styles.seatPctSelf, { fontSize: rf(15, undefined, undefined, screenW), width: rs(36, screenW) }]}
            >
              {pending ? '––' : `${s.pct}%`}
            </Text>
            <Text style={[styles.leadTag, { fontSize: rf(9, undefined, undefined, screenW), width: rs(30, screenW) }]}>
              {i === 0 && !pending ? 'LEAD' : ''}
            </Text>
          </View>
        ))}
        {deltaChip}
      </View>
    );
  }

  // ── 2 SEATS — the verified split bar ──────────────────────────────────────────────
  const opp = seats.find((s) => !s.isSelf);
  const oppPct = opp ? opp.pct : 100 - selfPct;
  const playerLeads = selfPct >= oppPct;
  const left = playerLeads
    ? { pct: selfPct, tag: 'LEADING', who: 'YOU', seat: self ? self.seat : 0, tid: 'equity-value-self' }
    : { pct: oppPct, tag: 'LEADING', who: 'OPP', seat: opp ? opp.seat : 1, tid: 'equity-value-opponent' };
  const right = playerLeads
    ? { pct: oppPct, tag: 'TRAILING', who: 'OPP', seat: opp ? opp.seat : 1, tid: 'equity-value-opponent' }
    : { pct: selfPct, tag: 'TRAILING', who: 'YOU', seat: self ? self.seat : 0, tid: 'equity-value-self' };

  return (
    <View style={styles.wrap} testID="equity-bar" accessibilityLiveRegion="polite"
      accessibilityLabel={pending ? 'Calculating odds' : `You ${selfPct} percent, opponent ${oppPct} percent`}>
      <View style={styles.figureRow}>
        {[left, right].map((side, i) => (
          <View key={i} style={[styles.figureCol, i === 1 && styles.figureColRight]}>
            <Text testID={side.tid} style={[styles.pct, { fontSize: rf(20, undefined, undefined, screenW) }]}>
              {pending ? '––' : `${side.pct}%`}
            </Text>
            {/* Same anchor scheme as the multi-seat layout, so a measurement does not have
                to know which layout it is looking at. */}
            <Text testID={`equity-value-seat-${side.seat}`} style={[styles.standing, { fontSize: rf(11, undefined, undefined, screenW) }]}>
              {side.who} · {side.tag}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.track, { height: barH, borderRadius: barH / 2 }]}>
        <Animated.View style={[styles.selfFill, { width: fill.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }), borderRadius: barH / 2 }]} />
        <Animated.View
          style={[styles.hatchClip, { left: fill.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]}
          pointerEvents="none"
        >
          <Hatch barH={barH} screenW={screenW} />
        </Animated.View>
        <Animated.View style={[styles.divider, { width: rs(2, screenW), left: fill.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} />
      </View>
      {deltaChip}
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
  track: { width: '100%', backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden', position: 'relative' },
  selfFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#4FD6A8' },
  hatchClip: { position: 'absolute', right: 0, top: 0, bottom: 0, overflow: 'hidden' },
  stripe: { position: 'absolute', top: -8, backgroundColor: 'rgba(255,255,255,0.30)', transform: [{ rotate: '45deg' }] },
  divider: { position: 'absolute', top: 0, bottom: 0, backgroundColor: '#FFFFFF' },

  // multi-seat
  seatRow: { flexDirection: 'row', alignItems: 'center' },
  ordinal: { color: 'rgba(255,255,255,0.55)', fontWeight: '800', fontVariant: ['tabular-nums'] },
  seatName: { color: 'rgba(255,255,255,0.75)', fontWeight: '700', letterSpacing: 0.4 },
  seatNameSelf: { color: '#FFFFFF', fontWeight: '900' },
  seatTrack: { flex: 1, backgroundColor: 'rgba(255,255,255,0.13)', overflow: 'hidden', position: 'relative' },
  seatFill: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden' },
  seatPct: { color: 'rgba(255,255,255,0.85)', fontWeight: '800', textAlign: 'right', fontVariant: ['tabular-nums'] },
  seatPctSelf: { color: '#FFFFFF', fontWeight: '900' },
  leadTag: { color: 'rgba(255,255,255,0.6)', fontWeight: '800', letterSpacing: 0.5, textAlign: 'right' },

  chip: { alignSelf: 'center', marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  chipText: { color: '#FFFFFF', fontWeight: '800', fontVariant: ['tabular-nums'] },
});

export default EquityBar;
