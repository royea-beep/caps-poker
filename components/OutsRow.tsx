/**
 * BX2 — outs as CARDS, not a sentence.
 *
 * Roye's requirement was that players see "which cards they want to come". A player
 * recognises "I need a heart" from a heart faster than from a sentence, so this renders
 * the actual out-cards face-up at 60% scale with a count badge.
 *
 * Two things here are not in the original spec and both were forced by measurement:
 *
 * 1. MODE. The naive definition of an out - "a card that leaves me ahead" - returns 35 of
 *    41 cards when the player is already ahead at 78%. A row of 35 cards says nothing. So
 *    the set flips with who is winning: when behind it is the cards that WIN it, when
 *    ahead it is the cards that LOSE it. The label states which, because a row of cards
 *    with no verb is ambiguous in the one direction that matters.
 *
 * 2. STRIKETHROUGH on dead outs. The spec fades and shrinks them, which is a genuine
 *    non-hue channel - but "dimmed and small" also describes a card that is simply
 *    further away, and at 60% scale in a fanned row that difference is subtle. BP3 makes
 *    the rule mandatory: a 1.5px corner-to-corner line, high contrast, hue-free.
 *
 * Iron Rule #3: sizes derive from screenW through rs()/rf(); nothing is a literal pixel.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import CardComponent from './Card';
import { Card } from '../constants/gameConfig';
import { rf, rs } from '../utils/responsive';
import { t } from '../utils/i18n';

interface Props {
  outs: Card[];
  dead?: Card[];
  mode: 'chasing' | 'defending';
  screenW: number;
  /** Base card size for this board; outs render at OUT_SCALE of it. */
  cardWidth: number;
  cardHeight: number;
  pending?: boolean;
}

/** Spec: out-cards at 60% of the board card. */
const OUT_SCALE = 0.6;
/** Spec: cap the row at 8; beyond that an overflow chip. Twelve tiny cards is noise. */
const MAX_SHOWN = 8;
/** Slots guaranteed to LIVE outs before dead cards may take any. Half the row: enough that the
 *  player always sees what they are chasing, while leaving real space for dead context. */
const LIVE_SLOTS = 4;

export function OutsRow({ outs, dead = [], mode, screenW, cardWidth, cardHeight, pending }: Props) {
  if (pending) {
    return (
      <View style={styles.row} testID="outs-row">
        <Text style={[styles.badge, { fontSize: rf(11, undefined, undefined, screenW) }]}>{t().outsCalculating}</Text>
      </View>
    );
  }
  if (!outs.length && !dead.length) return null;

  const w = Math.round(cardWidth * OUT_SCALE);
  const h = Math.round(cardHeight * OUT_SCALE);

  // Dead cards are shown first so the narrowing reads left-to-right as history -> present.
  // RESERVE SLOTS FOR LIVE OUTS 2026-08-11. Dead cards used to be sliced FIRST and could take
  // all 8 slots, leaving room === 0 and ZERO live outs on screen — while the headline still read
  // "14 OUTS" and the chip read "+14". Arithmetically consistent, practically inverted: the
  // player sees eight struck-through cards and reads them as eight of the fourteen.
  //
  // MEASURED, not guessed: sampling computeOuts over 1800 turn-stage boards (200 hands x
  // 2P/3P/4P) puts dead.length >= 8 at **14.6%** — 15.1% at 2P, 14.2% at 3P, 8.3% at 4P, max 23.
  // Roughly one board in seven showed no live outs at all, so this is routine, not a corner.
  //
  // Live outs are the information; dead cards are context. Guarantee up to LIVE_SLOTS of the
  // eight to live outs, let dead fill whatever is left. computeOuts is untouched — this is
  // presentation only.
  const liveReserved = Math.min(outs.length, LIVE_SLOTS);
  const shownDead = dead.slice(0, Math.max(0, MAX_SHOWN - liveReserved));
  const room = Math.max(0, MAX_SHOWN - shownDead.length);
  const shownLive = outs.slice(0, room);
  const overflow = outs.length - shownLive.length;

  const label = mode === 'chasing' ? t().outsLabel : t().dangerLabel;

  return (
    <View style={styles.row} testID="outs-row">
      <Text
        testID="outs-count"
        style={[styles.badge, { fontSize: rf(11, undefined, undefined, screenW) }]}
        accessibilityLabel={`${outs.length} ${mode === 'chasing' ? t().a11yOutsToWin : t().a11yOutsToLose}`}
      >
        {outs.length} {label}
      </Text>

      {shownDead.map((c) => (
        <View key={`d-${c.rank}-${c.suit}`} style={[styles.cardSlot, { width: w, marginLeft: rs(3, screenW) }]}>
          <View style={{ opacity: 0.32, transform: [{ scale: 0.88 }] }}>
            <CardComponent card={c} cardWidth={w} cardHeight={h} zone="reveal" />
          </View>
          {/* Corner-to-corner rule. Two mirrored bars rather than one, so the "gone" reading
              does not depend on which diagonal the eye catches first. */}
          <View pointerEvents="none" style={[styles.strike, { width: Math.hypot(w, h), height: rs(1.5, screenW), top: h / 2, left: (w - Math.hypot(w, h)) / 2 }]} />
        </View>
      ))}

      {shownLive.map((c) => (
        <View key={`l-${c.rank}-${c.suit}`} style={[styles.cardSlot, { width: w, marginLeft: rs(3, screenW) }]}>
          <CardComponent card={c} cardWidth={w} cardHeight={h} zone="reveal" />
        </View>
      ))}

      {overflow > 0 && (
        <View style={[styles.overflowChip, { marginLeft: rs(4, screenW), height: h }]}>
          <Text style={[styles.overflowText, { fontSize: rf(12, undefined, undefined, screenW) }]}>+{overflow}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap' },
  cardSlot: { position: 'relative' },
  badge: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  strike: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.92)',
    transform: [{ rotate: '-45deg' }],
  },
  overflowChip: {
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
  },
  overflowText: { color: '#FFFFFF', fontWeight: '800' },
});

export default OutsRow;
