/** Hand strength color coding — used by HandBadge and BoardReveal (S114) */
export const HAND_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  'Royal Flush':     { bg: '#FFD700', text: '#1a1a2e', label: 'ROYAL FLUSH' },
  'Straight Flush':  { bg: '#FFA500', text: '#1a1a2e', label: 'STRAIGHT FLUSH' },
  'Four of a Kind':  { bg: '#c9a84c', text: '#1a1a2e', label: 'FOUR OF A KIND' },
  'Full House':      { bg: '#9C27B0', text: '#fff',    label: 'FULL HOUSE' },
  'Flush':           { bg: '#2196F3', text: '#fff',    label: 'FLUSH' },
  'Straight':        { bg: '#4CAF50', text: '#fff',    label: 'STRAIGHT' },
  'Three of a Kind': { bg: '#8BC34A', text: '#1a1a2e', label: 'THREE OF A KIND' },
  'Two Pair':        { bg: '#FF9800', text: '#1a1a2e', label: 'TWO PAIR' },
  'One Pair':        { bg: '#FF5722', text: '#fff',    label: 'ONE PAIR' },
  'High Card':       { bg: '#607D8B', text: '#fff',    label: 'HIGH CARD' },
};

export const HAND_RANK: Record<string, number> = {
  'High Card': 1, 'One Pair': 2, 'Two Pair': 3, 'Three of a Kind': 4,
  'Straight': 5, 'Flush': 6, 'Full House': 7, 'Four of a Kind': 8,
  'Straight Flush': 9, 'Royal Flush': 10,
};

export const BIG_HANDS = ['Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'Royal Flush'];
