/**
 * Hand strength color coding — used by HandBadge and BoardReveal (S114).
 * Labels were removed 2026-06-30: the badge now derives its (English) text from
 * getHandName() so there is a single source of truth (VAMOS-HAND-LABELS-ENGLISH
 * 2026-06-17). The stale Hebrew `label` fields were the last consumer of the old
 * dual-naming system. This map is colors-only now.
 */
export const HAND_COLORS: Record<string, { bg: string; text: string }> = {
  'Royal Flush':     { bg: '#FFD700', text: '#1a1a2e' },
  'Straight Flush':  { bg: '#FFA500', text: '#1a1a2e' },
  'Four of a Kind':  { bg: '#c9a84c', text: '#1a1a2e' },
  'Full House':      { bg: '#9C27B0', text: '#fff'    },
  'Flush':           { bg: '#2196F3', text: '#fff'    },
  'Straight':        { bg: '#4CAF50', text: '#fff'    },
  'Three of a Kind': { bg: '#8BC34A', text: '#1a1a2e' },
  'Two Pair':        { bg: '#FF9800', text: '#1a1a2e' },
  'One Pair':        { bg: '#FF5722', text: '#fff'    },
  'High Card':       { bg: '#607D8B', text: '#fff'    },
};

export const HAND_RANK: Record<string, number> = {
  'High Card': 1, 'One Pair': 2, 'Two Pair': 3, 'Three of a Kind': 4,
  'Straight': 5, 'Flush': 6, 'Full House': 7, 'Four of a Kind': 8,
  'Straight Flush': 9, 'Royal Flush': 10,
};

export const BIG_HANDS = ['Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'Royal Flush'];
