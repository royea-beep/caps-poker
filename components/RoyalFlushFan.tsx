import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Card from './Card';
import { rf, rs } from '../utils/responsive';
import type { Card as CardType } from '../constants/cards';

/**
 * RoyalFlushFan — the royal-flush hero fan (LUXURY-HOME 2026-09-01).
 *
 * Five REAL cards — 10 J Q K A of spades — rendered with the app's own components/Card.tsx at a
 * small size, fanned from a single shared bottom pivot (a hand-of-cards fan, not five tilted
 * rectangles). Uses the real Card, NOT a redrawn SVG, so the home cards can never drift from the
 * in-game cards. Below the fan, a small gilded "ROYAL FLUSH" caption in the wordmark gold #c9a84c
 * (NOT the winner gold #FFD700 — this is not a cue).
 *
 * Card.tsx renders a static face when faceDown is false and a card is provided; passing no
 * owner/zone means no ownership glow, and highlighted=false means the neutral 1px border (never the
 * gold winner cue). cardWidth/cardHeight are the documented sizing props — no fork, no cue touched.
 *
 * Sizing is caller-provided (cardW), computed with rv upstream — no pixel literals here beyond the
 * fan geometry ratios (which are proportions of the card, not screen px).
 */

const ROYAL: CardType[] = [
  { rank: '10', suit: 'spades', id: 'royal_10s' },
  { rank: 'J', suit: 'spades', id: 'royal_Js' },
  { rank: 'Q', suit: 'spades', id: 'royal_Qs' },
  { rank: 'K', suit: 'spades', id: 'royal_Ks' },
  { rank: 'A', suit: 'spades', id: 'royal_As' },
];

const ANGLE_STEP = 6; // gentle tilt per card — the spread is carried by translateX, the tilt only
// gives the hand its curve. Every rank index (10 J Q K A) stays clear of the card in front of it.
const OVERLAP = 0.42; // each card shifted right by 42% of a card width → ~58% overlap, corners visible

export function RoyalFlushFan({ cardW }: { cardW: number }) {
  const w = cardW;
  const h = Math.round(w * 1.4);
  const n = ROYAL.length;
  const mid = (n - 1) / 2;
  const stepX = Math.round(w * OVERLAP);
  const maxAngle = mid * ANGLE_STEP;
  const lift = Math.round(h * Math.sin((maxAngle * Math.PI) / 180)); // vertical swing of the outer tilt
  const containerH = h + lift + Math.round(h * 0.06);
  const containerW = w + stepX * (n - 1) + Math.round(w * 0.3);

  return (
    <View style={styles.wrap}>
      <View style={{ width: containerW, height: containerH }}>
        {ROYAL.map((c, i) => {
          const angle = (i - mid) * ANGLE_STEP;
          const tx = (i - mid) * stepX;
          // A spread hand: each card offset horizontally (so its top-left index peeks past the one
          // in front) and tilted gently about its own bottom-centre for the fan curve.
          const spokeStyle: ViewStyle = {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: containerH,
            alignItems: 'center',
            justifyContent: 'flex-end',
            transformOrigin: 'bottom center',
            transform: [{ translateX: tx }, { rotate: `${angle}deg` }],
          };
          return (
            <View key={c.id} style={spokeStyle} pointerEvents="none">
              <Card card={c} cardWidth={w} cardHeight={h} />
            </View>
          );
        })}
      </View>
      <Text style={styles.caption} allowFontScaling={false}>
        ROYAL FLUSH
      </Text>
    </View>
  );
}

export default RoyalFlushFan;

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: rs(6),
  },
  caption: {
    // wordmark gold #c9a84c — a gilded caption, deliberately NOT the winner gold #FFD700.
    color: '#c9a84c',
    fontSize: rf(11, 9, 13),
    fontWeight: '800',
    letterSpacing: rs(3),
    textTransform: 'uppercase',
  },
});
