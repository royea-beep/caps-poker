export interface ProQuote {
  id: string;
  player: string;
  emoji: string;
  quote: string;
  context: 'home' | 'loading' | 'complete' | 'summary' | 'waiting' | 'tutorial';
}

export const PRO_QUOTES: ProQuote[] = [
  // HOME SCREEN
  { id: 'dn1', player: 'Daniel Negreanu', emoji: '🇨🇦', quote: 'The most original poker mechanic since PLO', context: 'home' },
  { id: 'ph1', player: 'Phil Hellmuth', emoji: '👑', quote: 'I hate admitting it, but this is smart', context: 'home' },
  { id: 'pi1', player: 'Phil Ivey', emoji: '🃏', quote: 'Ship it.', context: 'home' },
  { id: 'ey2', player: 'Rampage', emoji: '📺', quote: 'Chess meets Omaha meets fantasy draft', context: 'home' },

  // WAITING FOR OPPONENT
  { id: 'mm1', player: 'Michael Mizrachi', emoji: '💪', quote: 'Deal again. NOW.', context: 'waiting' },
  { id: 'es1', player: 'Erik Seidel', emoji: '🎩', quote: 'First poker game in 10 years that surprised me', context: 'waiting' },
  { id: 'jb1', player: 'Justin Bonomo', emoji: '🧮', quote: 'GTO implications are massive', context: 'waiting' },
  { id: 'bk2', player: 'Bryn Kenney', emoji: '💰', quote: '90 seconds. Perfect for quick games anywhere.', context: 'waiting' },

  // COMPLETE BONUS
  { id: 'ph2', player: 'Phil Hellmuth', emoji: '👑', quote: 'When I got COMPLETE I felt like I won a bracelet', context: 'complete' },
  { id: 'bk1', player: 'Bryn Kenney', emoji: '💰', quote: 'This is your Victory Royale moment', context: 'complete' },
  { id: 'ey1', player: 'Rampage', emoji: '📺', quote: 'COMPLETE = clips. Clips = views. Views = downloads.', context: 'complete' },
  { id: 'ck1', player: 'Chance Kornuth', emoji: '🎓', quote: 'COMPLETE mechanic = pure product genius', context: 'complete' },

  // SUMMARY SCREEN
  { id: 'dn2', player: 'Daniel Negreanu', emoji: '🇨🇦', quote: 'I forgot I was testing. I was just playing.', context: 'summary' },
  { id: 'mm2', player: 'Michael Mizrachi', emoji: '💪', quote: 'I want to play this for money. Right now.', context: 'summary' },
  { id: 'ph3', player: 'Phil Hellmuth', emoji: '👑', quote: 'I got angry when I lost. THAT is a good sign.', context: 'summary' },
  { id: 'ai1', player: 'Ali Imsirovic', emoji: '🌊', quote: 'Played 10 hands, wanted 10 more', context: 'summary' },

  // GAME SCREEN — tips during arrangement
  { id: 'dn3', player: 'Daniel Negreanu', emoji: '🇨🇦', quote: 'Stack one board or spread evenly? THAT is the question.', context: 'tutorial' },
  { id: 'pi2', player: 'Phil Ivey', emoji: '🃏', quote: 'You can read opponents through allocation patterns', context: 'tutorial' },
  { id: 'jb2', player: 'Justin Bonomo', emoji: '🧮', quote: 'Three strategies: stack-one, spread-even, read-and-counter', context: 'tutorial' },
  { id: 'ck2', player: 'Chance Kornuth', emoji: '🎓', quote: 'Build your ENTIRE strategy around chasing COMPLETE', context: 'tutorial' },
];

export function getRandomQuote(context: ProQuote['context']): ProQuote {
  const filtered = PRO_QUOTES.filter(q => q.context === context);
  return filtered[Math.floor(Math.random() * filtered.length)];
}
