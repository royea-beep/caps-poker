// VAMOS-VISUAL-PASS-1 2026-06-19 — pure-View "ghost" previews shown at 25%
// opacity inside EmptyState. Each is a tiny stylised mock of the real screen's
// payoff so the empty view PREVIEWS the value the user will see once they play.
// All pieces use COLORS tokens + responsive units (rs/rv/rf).
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/gameConfig';
import { rf, rs, rv } from '../utils/responsive';

// Rank ladder — 3 vertical bars of increasing height, suggesting tiers.
export function RankLadderPreview() {
  return (
    <View style={previewStyles.row}>
      {[rs(44), rs(62), rs(82)].map((h, i) => (
        <View key={i} style={[previewStyles.bar, { height: h }]} />
      ))}
    </View>
  );
}

// Stats cards — 2 mini placeholder cards with a label + number bar.
export function StatsCardsPreview() {
  return (
    <View style={previewStyles.row}>
      {[0, 1].map((i) => (
        <View key={i} style={previewStyles.card}>
          <View style={previewStyles.line} />
          <View style={[previewStyles.line, { width: rs(36), height: rs(10), marginTop: rs(6) }]} />
        </View>
      ))}
    </View>
  );
}

// Heatmap grid — 5×3 squares.
export function HeatmapGridPreview() {
  return (
    <View style={{ gap: rs(3) }}>
      {[0, 1, 2].map((row) => (
        <View key={row} style={{ flexDirection: 'row', gap: rs(3) }}>
          {[0, 1, 2, 3, 4].map((col) => (
            <View key={col} style={previewStyles.heatCell} />
          ))}
        </View>
      ))}
    </View>
  );
}

// Coaching tip — a soft card with a couple of mock lines.
export function CoachingTipPreview() {
  return (
    <View style={[previewStyles.card, { width: rs(220), padding: rs(10) }]}>
      <View style={previewStyles.line} />
      <View style={[previewStyles.line, { width: rs(150), marginTop: rs(6) }]} />
      <View style={[previewStyles.line, { width: rs(110), marginTop: rs(6) }]} />
    </View>
  );
}

// Hand history — 3 stacked mock rows with a tiny "card pip" + line.
export function HandHistoryPreview() {
  return (
    <View style={{ gap: rs(6) }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={previewStyles.historyRow}>
          <View style={previewStyles.pip}>
            <Text style={previewStyles.pipText}>♠</Text>
          </View>
          <View style={[previewStyles.line, { width: rs(120) }]} />
        </View>
      ))}
    </View>
  );
}

const previewStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: rs(8) },
  bar: {
    width: rs(28),
    borderTopLeftRadius: rv(4),
    borderTopRightRadius: rv(4),
    backgroundColor: COLORS.mint,
  },
  card: {
    width: rs(96),
    height: rs(64),
    backgroundColor: COLORS.surface,
    borderRadius: rv(8),
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: rs(8),
    justifyContent: 'center',
  },
  line: {
    width: rs(54),
    height: rs(8),
    borderRadius: rv(4),
    backgroundColor: COLORS.border,
  },
  heatCell: {
    width: rs(20),
    height: rs(20),
    borderRadius: rv(4),
    backgroundColor: COLORS.mint,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(8),
    backgroundColor: COLORS.surface,
    borderRadius: rv(8),
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: rs(10),
    paddingVertical: rs(6),
  },
  pip: {
    width: rs(22),
    height: rs(22),
    borderRadius: rv(4),
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipText: {
    color: COLORS.textMuted,
    fontSize: rf(12),
    fontWeight: '700',
  },
});
