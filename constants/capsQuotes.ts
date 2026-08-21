/**
 * Daily quote rotation — CAPS-attributed strings only.
 *
 * Replaces constants/proQuotes.ts, archived 2026-08-21. That file carried two layers of strings
 * attributed to real named people: 20 fabricated product endorsements from ten living pros (each
 * with an ElevenLabs voice clone of that person) and 82 invented aphorisms credited to 27 more,
 * several of them dead. None carried a citation.
 *
 * The line is PROVENANCE, not truthfulness: a real quote with no source and an invented one are
 * indistinguishable in code, so anything naming a third party went to the archive whether or not it
 * was genuine. What remains names nobody but us.
 *
 * Archive: _archive/attributed-quotes/ (outside git, outside the build) — README.md there records
 * every name and why.
 */

export interface DailyQuote { text: string; author: string; }

export const DAILY_QUOTES: DailyQuote[] = [
  { text: 'Every board, one mind. That is CAPS.', author: 'CAPS Poker' },
  { text: 'In multi-board poker, a split victory is still victory.', author: 'CAPS Poker' },
  { text: 'Every board is another chance to outthink your opponent.', author: 'CAPS Poker' },
  { text: 'In CAPS, spreading your hand is spreading your power.', author: 'CAPS Poker' },
  { text: 'CAPS rewards allocation. Know when to stack one board.', author: 'CAPS Poker' },
  { text: 'In multi-board games, tempo is a weapon.', author: 'CAPS Poker' },
  { text: 'Every card you place is a decision. Make it count.', author: 'CAPS Poker' },
  { text: 'Every board is another decision. Each one matters equally.', author: 'CAPS Poker' },
  { text: 'In CAPS, the board you sacrifice can win you the match.', author: 'CAPS Poker' },
  { text: 'CAPS is chess played at the speed of poker.', author: 'CAPS Poker' },
  { text: 'In CAPS, every board is another opportunity to outread.', author: 'CAPS Poker' },
  { text: 'Multi-board thinking: sacrifice one, dominate three.', author: 'CAPS Poker' },
  { text: 'In CAPS, the player who adapts board by board wins.', author: 'CAPS Poker' },
  { text: 'CAPS: where Omaha strategy meets board allocation mastery.', author: 'CAPS Poker' },
  { text: 'In CAPS, controlling one board can shift momentum on all four.', author: 'CAPS Poker' },
  { text: 'CAPS teaches you to read the war, not just the battle.', author: 'CAPS Poker' },
  { text: 'Every board, infinite strategy. That is the beauty of CAPS.', author: 'CAPS Poker' },
  { text: 'In CAPS, your allocation strategy is your signature.', author: 'CAPS Poker' },
];

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function getTodaysQuote(): DailyQuote {
  const now = new Date();
  const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  const shuffled = seededShuffle(DAILY_QUOTES, seed);
  const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
  return shuffled[Math.floor(minutesSinceMidnight / 10) % shuffled.length];
}

export const todaysQuote: DailyQuote = getTodaysQuote();
