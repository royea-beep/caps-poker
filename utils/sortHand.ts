// utils/sortHand.ts
import { Card } from '../constants/gameConfig';

const RANK_VAL: Record<string, number> = {
  '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,
  '9':9,'10':10,'J':11,'Q':12,'K':13,'A':14
};
const SUIT_VAL: Record<string, number> = {
  spades:0, hearts:1, diamonds:2, clubs:3
};

export function sortHandCAPS(cards: Card[]): Card[] {
  if (!cards?.length) return cards;
  const cnt: Record<string, number> = {};
  cards.forEach(c => { cnt[c.rank] = (cnt[c.rank] ?? 0) + 1; });
  return [...cards].sort((a, b) => {
    const fd = cnt[b.rank] - cnt[a.rank];
    if (fd !== 0) return fd;
    if (cnt[a.rank] > 1) {
      const rd = RANK_VAL[a.rank] - RANK_VAL[b.rank];
      return rd !== 0 ? rd : SUIT_VAL[a.suit] - SUIT_VAL[b.suit];
    }
    const sd = SUIT_VAL[a.suit] - SUIT_VAL[b.suit];
    return sd !== 0 ? sd : RANK_VAL[a.rank] - RANK_VAL[b.rank];
  });
}

export function sortHandUser(cards: Card[]): Card[] {
  if (!cards?.length) return cards;
  const cnt: Record<string, number> = {};
  cards.forEach(c => { cnt[c.rank] = (cnt[c.rank] ?? 0) + 1; });
  return [...cards].sort((a, b) => {
    const ha = cnt[a.rank] > 1 ? 0 : 1;
    const hb = cnt[b.rank] > 1 ? 0 : 1;
    if (ha !== hb) return ha - hb;
    const sd = SUIT_VAL[a.suit] - SUIT_VAL[b.suit];
    return sd !== 0 ? sd : RANK_VAL[a.rank] - RANK_VAL[b.rank];
  });
}

export function sortHand(cards: Card[], method: 'caps' | 'user' = 'caps'): Card[] {
  return method === 'user' ? sortHandUser(cards) : sortHandCAPS(cards);
}
