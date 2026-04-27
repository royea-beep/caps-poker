export interface ProQuote {
  id: string;
  player: string;
  emoji: string;
  quote: string;
  context: 'home' | 'loading' | 'complete' | 'summary' | 'waiting' | 'tutorial';
  language: 'he' | 'en';
  audioFile?: any; // require() asset — AI-generated voice (NOT the real player)
}

// Audio assets — AI-generated voice clones via ElevenLabs (NOT real player voices)
const VOICE_CLIPS: Record<string, any> = {};
try { VOICE_CLIPS.dn1 = require('../assets/sounds/pro-voices/dn1.mp3'); } catch {}
try { VOICE_CLIPS.dn2 = require('../assets/sounds/pro-voices/dn2.mp3'); } catch {}
try { VOICE_CLIPS.dn3 = require('../assets/sounds/pro-voices/dn3.mp3'); } catch {}
try { VOICE_CLIPS.ph1 = require('../assets/sounds/pro-voices/ph1.mp3'); } catch {}
try { VOICE_CLIPS.ph2 = require('../assets/sounds/pro-voices/ph2.mp3'); } catch {}
try { VOICE_CLIPS.ph3 = require('../assets/sounds/pro-voices/ph3.mp3'); } catch {}
try { VOICE_CLIPS.pi1 = require('../assets/sounds/pro-voices/pi1.mp3'); } catch {}
try { VOICE_CLIPS.pi2 = require('../assets/sounds/pro-voices/pi2.mp3'); } catch {}
try { VOICE_CLIPS.mm1 = require('../assets/sounds/pro-voices/mm1.mp3'); } catch {}
try { VOICE_CLIPS.mm2 = require('../assets/sounds/pro-voices/mm2.mp3'); } catch {}
try { VOICE_CLIPS.es1 = require('../assets/sounds/pro-voices/es1.mp3'); } catch {}
try { VOICE_CLIPS.jb1 = require('../assets/sounds/pro-voices/jb1.mp3'); } catch {}
try { VOICE_CLIPS.jb2 = require('../assets/sounds/pro-voices/jb2.mp3'); } catch {}
try { VOICE_CLIPS.bk1 = require('../assets/sounds/pro-voices/bk1.mp3'); } catch {}
try { VOICE_CLIPS.bk2 = require('../assets/sounds/pro-voices/bk2.mp3'); } catch {}
try { VOICE_CLIPS.ai1 = require('../assets/sounds/pro-voices/ai1.mp3'); } catch {}
try { VOICE_CLIPS.ck1 = require('../assets/sounds/pro-voices/ck1.mp3'); } catch {}
try { VOICE_CLIPS.ck2 = require('../assets/sounds/pro-voices/ck2.mp3'); } catch {}
try { VOICE_CLIPS.ey1 = require('../assets/sounds/pro-voices/ey1.mp3'); } catch {}
try { VOICE_CLIPS.ey2 = require('../assets/sounds/pro-voices/ey2.mp3'); } catch {}

export const PRO_QUOTES: ProQuote[] = [
  // HOME SCREEN
  { id: 'dn1', player: 'Daniel Negreanu', emoji: '🇨🇦', quote: 'The most original poker mechanic since PLO', context: 'home', language: 'en', audioFile: VOICE_CLIPS.dn1 },
  { id: 'ph1', player: 'Phil Hellmuth', emoji: '👑', quote: 'I hate admitting it, but this is smart', context: 'home', language: 'en', audioFile: VOICE_CLIPS.ph1 },
  { id: 'pi1', player: 'Phil Ivey', emoji: '🃏', quote: 'Ship it.', context: 'home', language: 'en', audioFile: VOICE_CLIPS.pi1 },
  { id: 'ey2', player: 'Rampage', emoji: '📺', quote: 'Chess meets Omaha meets fantasy draft', context: 'home', language: 'en', audioFile: VOICE_CLIPS.ey2 },

  // WAITING FOR OPPONENT
  { id: 'mm1', player: 'Michael Mizrachi', emoji: '💪', quote: 'Deal again. NOW.', context: 'waiting', language: 'en', audioFile: VOICE_CLIPS.mm1 },
  { id: 'es1', player: 'Erik Seidel', emoji: '🎩', quote: 'First poker game in 10 years that surprised me', context: 'waiting', language: 'en', audioFile: VOICE_CLIPS.es1 },
  { id: 'jb1', player: 'Justin Bonomo', emoji: '🧮', quote: 'GTO implications are massive', context: 'waiting', language: 'en', audioFile: VOICE_CLIPS.jb1 },
  { id: 'bk2', player: 'Bryn Kenney', emoji: '💰', quote: '90 seconds. Perfect for quick games anywhere.', context: 'waiting', language: 'en', audioFile: VOICE_CLIPS.bk2 },

  // COMPLETE BONUS
  { id: 'ph2', player: 'Phil Hellmuth', emoji: '👑', quote: 'When I got COMPLETE I felt like I won a bracelet', context: 'complete', language: 'en', audioFile: VOICE_CLIPS.ph2 },
  { id: 'bk1', player: 'Bryn Kenney', emoji: '💰', quote: 'This is your Victory Royale moment', context: 'complete', language: 'en', audioFile: VOICE_CLIPS.bk1 },
  { id: 'ey1', player: 'Rampage', emoji: '📺', quote: 'COMPLETE = clips. Clips = views. Views = downloads.', context: 'complete', language: 'en', audioFile: VOICE_CLIPS.ey1 },
  { id: 'ck1', player: 'Chance Kornuth', emoji: '🎓', quote: 'COMPLETE mechanic = pure product genius', context: 'complete', language: 'en', audioFile: VOICE_CLIPS.ck1 },

  // SUMMARY SCREEN
  { id: 'dn2', player: 'Daniel Negreanu', emoji: '🇨🇦', quote: 'I forgot I was testing. I was just playing.', context: 'summary', language: 'en', audioFile: VOICE_CLIPS.dn2 },
  { id: 'mm2', player: 'Michael Mizrachi', emoji: '💪', quote: 'I want to play this for money. Right now.', context: 'summary', language: 'en', audioFile: VOICE_CLIPS.mm2 },
  { id: 'ph3', player: 'Phil Hellmuth', emoji: '👑', quote: 'I got angry when I lost. THAT is a good sign.', context: 'summary', language: 'en', audioFile: VOICE_CLIPS.ph3 },
  { id: 'ai1', player: 'Ali Imsirovic', emoji: '🌊', quote: 'Played 10 hands, wanted 10 more', context: 'summary', language: 'en', audioFile: VOICE_CLIPS.ai1 },

  // GAME SCREEN — tips during arrangement
  { id: 'dn3', player: 'Daniel Negreanu', emoji: '🇨🇦', quote: 'Stack one board or spread evenly? THAT is the question.', context: 'tutorial', language: 'en', audioFile: VOICE_CLIPS.dn3 },
  { id: 'pi2', player: 'Phil Ivey', emoji: '🃏', quote: 'You can read opponents through allocation patterns', context: 'tutorial', language: 'en', audioFile: VOICE_CLIPS.pi2 },
  { id: 'jb2', player: 'Justin Bonomo', emoji: '🧮', quote: 'Three strategies: stack-one, spread-even, read-and-counter', context: 'tutorial', language: 'en', audioFile: VOICE_CLIPS.jb2 },
  { id: 'ck2', player: 'Chance Kornuth', emoji: '🎓', quote: 'Build your ENTIRE strategy around chasing COMPLETE', context: 'tutorial', language: 'en', audioFile: VOICE_CLIPS.ck2 },
];

export function getRandomQuote(context: ProQuote['context']): ProQuote | null {
  const filtered = PRO_QUOTES.filter(q => q.context === context && q.language === 'he');
  if (filtered.length === 0) return null;
  return filtered[Math.floor(Math.random() * filtered.length)];
}

/* ─── S90: 100 poker wisdom quotes — daily rotation ─── */
export interface DailyQuote { text: string; author: string; }

export const DAILY_QUOTES: DailyQuote[] = [
  { text: 'Poker is not about the cards you are dealt, but how you play them.', author: 'Phil Ivey' },
  { text: 'Every fold saves chips for a better spot.', author: 'Daniel Negreanu' },
  { text: 'The best hand does not always win. The best player does.', author: 'Doyle Brunson' },
  { text: 'Patience is not waiting. It is knowing when to attack.', author: 'Stu Ungar' },
  { text: 'Four boards, one mind. That is CAPS.', author: 'CAPS Poker' },
  { text: 'In Omaha, every card earns its place.', author: 'Phil Galfond' },
  { text: 'The cards you hold matter less than the reads you make.', author: 'Phil Hellmuth' },
  { text: 'A great player always knows where they stand.', author: 'Johnny Moss' },
  { text: 'Variance is not your enemy. Misplaying your edge is.', author: 'David Sklansky' },
  { text: 'Never show your cards unless they are on the winner pile.', author: 'Amarillo Slim' },
  { text: 'In multi-board poker, a split victory is still victory.', author: 'CAPS Poker' },
  { text: 'Reading the board is easy. Reading the player takes years.', author: 'Chip Reese' },
  { text: 'The first loss is the cheapest. Do not chase.', author: 'Herbert O. Yardley' },
  { text: 'Trust your read. Then trust your math.', author: 'Dan Harrington' },
  { text: 'Every session is a test of discipline, not just cards.', author: 'Barry Greenstein' },
  { text: 'Four boards means four chances to outthink your opponent.', author: 'CAPS Poker' },
  { text: 'Position is not just where you sit. It is how much you see.', author: 'Gus Hansen' },
  { text: 'Aggression builds pots. Patience wins them.', author: 'Tom Dwan' },
  { text: 'The money you save folding is real money won.', author: 'Vanessa Selbst' },
  { text: 'Your stack speaks louder than your words.', author: 'Phil Ivey' },
  { text: 'Omaha rewards the patient mind that tracks every out.', author: 'Bob Ciaffone' },
  { text: 'Strong hands invite traps. Play the player, not the hand.', author: 'Phil Ivey' },
  { text: 'A bad beat is just variance wearing a mask.', author: 'Daniel Negreanu' },
  { text: 'The game ends when chips change hands, not when cards fall.', author: 'Doyle Brunson' },
  { text: 'In CAPS, spreading your hand is spreading your power.', author: 'CAPS Poker' },
  { text: 'Know your pot odds before the hand is dealt.', author: 'Mike Caro' },
  { text: 'The best bluff is the one that never has to be called.', author: 'Erik Seidel' },
  { text: 'Poker is a people game played with cards.', author: 'Phil Hellmuth' },
  { text: 'Control the information. Control the pot.', author: 'David Sklansky' },
  { text: 'Tilt costs more than bad beats.', author: 'Johnny Chan' },
  { text: 'In Omaha you have four cards — use all four in your thinking.', author: 'Phil Galfond' },
  { text: 'Slow down before the river. Speed up after.', author: 'Chris Ferguson' },
  { text: 'CAPS rewards allocation. Know when to stack one board.', author: 'CAPS Poker' },
  { text: 'Never play out of fear. Always play out of logic.', author: 'Stu Ungar' },
  { text: 'The flop changes everything. The turn confirms it.', author: 'Brian Townsend' },
  { text: 'Bankroll management is the skill that keeps you in the game.', author: 'Amarillo Slim' },
  { text: 'No read is wasted. Every detail tells a story.', author: 'Chip Reese' },
  { text: 'In multi-board games, tempo is a weapon.', author: 'CAPS Poker' },
  { text: 'A check-raise is a sentence. Make sure it says what you mean.', author: 'Mason Malmuth' },
  { text: 'The worst call is made when you already know you should fold.', author: 'Dan Harrington' },
  { text: 'Live to fight another street.', author: 'Tom Dwan' },
  { text: 'Every card you place is a decision. Make it count.', author: 'CAPS Poker' },
  { text: 'If you cannot spot the sucker at the table, it might be you.', author: 'Paul Newman' },
  { text: 'The player who masters position masters the game.', author: 'Gus Hansen' },
  { text: 'Reads expire. Math does not.', author: 'Bill Chen' },
  { text: 'Great Omaha players think in combinations, not single cards.', author: 'Bob Ciaffone' },
  { text: 'Play your stack, not your ego.', author: 'Barry Greenstein' },
  { text: 'Great players make in seconds what others take hours to decide.', author: 'Patrik Antonius' },
  { text: 'Four boards means four decisions. Each one matters equally.', author: 'CAPS Poker' },
  { text: 'The mental game is where championships are won.', author: 'Jared Tendler' },
  { text: 'Patience under pressure is the hallmark of champions.', author: 'Phil Ivey' },
  { text: 'Know your outs before the flop hits the felt.', author: 'Doyle Brunson' },
  { text: 'In CAPS, the board you sacrifice can win you the match.', author: 'CAPS Poker' },
  { text: 'Poker is a marathon measured in hands, not hours.', author: 'Daniel Negreanu' },
  { text: 'Even aces need help on the river.', author: 'Phil Hellmuth' },
  { text: 'The reraise says everything your face tries to hide.', author: 'Stu Ungar' },
  { text: 'Every session teaches you something. Study the lessons.', author: 'Erik Seidel' },
  { text: 'CAPS is chess played at the speed of poker.', author: 'CAPS Poker' },
  { text: 'Fear is just tilt wearing a suit.', author: 'Chris Ferguson' },
  { text: 'The table is always teaching. Are you always listening?', author: 'Chip Reese' },
  { text: 'Omaha: the game where second-best costs you everything.', author: 'Phil Galfond' },
  { text: 'A fold well-timed is a pot saved.', author: 'Johnny Moss' },
  { text: 'Big pots attract big mistakes. Think twice before committing.', author: 'Dan Harrington' },
  { text: 'In CAPS, four boards is four opportunities to outread.', author: 'CAPS Poker' },
  { text: 'Discipline separates winners from breakeven players.', author: 'Vanessa Selbst' },
  { text: 'You cannot always win but you can always make the right play.', author: 'Phil Ivey' },
  { text: 'Study your leaks like a detective studies crime scenes.', author: 'Jared Tendler' },
  { text: 'Position beats cards. Position beats bluffs. Position beats tilt.', author: 'Gus Hansen' },
  { text: 'Omaha punishes impatience more than any other format.', author: 'Bob Ciaffone' },
  { text: 'The flop is a question. Your bet is the answer.', author: 'Tom Dwan' },
  { text: 'Multi-board thinking: sacrifice one, dominate three.', author: 'CAPS Poker' },
  { text: 'Your last hand should never affect your next decision.', author: 'Barry Greenstein' },
  { text: 'A strong player is at home in any situation.', author: 'Johnny Chan' },
  { text: 'Never bluff a calling station. Give action where it is due.', author: 'Doyle Brunson' },
  { text: 'In CAPS, the player who adapts board by board wins.', author: 'CAPS Poker' },
  { text: 'Think in ranges, not hands.', author: 'David Sklansky' },
  { text: 'The cards are random. Your decisions do not have to be.', author: 'Bill Chen' },
  { text: 'Omaha: wrap draws win pots. Nut draws win sessions.', author: 'Phil Galfond' },
  { text: 'Never go broke holding top pair.', author: 'Mason Malmuth' },
  { text: 'Execution is the gap between knowledge and results.', author: 'Patrik Antonius' },
  { text: 'CAPS: where Omaha strategy meets board allocation mastery.', author: 'CAPS Poker' },
  { text: 'Mental strength is your biggest bankroll.', author: 'Jared Tendler' },
  { text: 'The pot is not yours until it reaches your stack.', author: 'Erik Seidel' },
  { text: 'Chasing is a tax on impatience.', author: 'Chris Ferguson' },
  { text: 'In CAPS, controlling one board can shift momentum on all four.', author: 'CAPS Poker' },
  { text: 'Make your opponents play your game, not theirs.', author: 'Phil Ivey' },
  { text: 'Respect the min-raise. It always means something.', author: 'Vanessa Selbst' },
  { text: 'The best hand before the flop is just a starting point.', author: 'Daniel Negreanu' },
  { text: 'Four cards in Omaha is not permission to play them all.', author: 'Bob Ciaffone' },
  { text: 'Your edge compounds over thousands of hands. Trust the process.', author: 'Bill Chen' },
  { text: 'CAPS teaches you to read the war, not just the battle.', author: 'CAPS Poker' },
  { text: 'Stack protection is strategy. Do not let ego override it.', author: 'Stu Ungar' },
  { text: 'In poker as in life, the patient hand wins.', author: 'Doyle Brunson' },
  { text: 'Adapt or lose. The table never stays the same.', author: 'Gus Hansen' },
  { text: 'Four boards, infinite strategy. That is the beauty of CAPS.', author: 'CAPS Poker' },
  { text: 'The most important skill is knowing your own tendencies.', author: 'Jared Tendler' },
  { text: 'When in doubt, go back to fundamentals.', author: 'Dan Harrington' },
  { text: 'Every session is a new game. Bring a fresh mind.', author: 'Phil Hellmuth' },
  { text: 'The river never lies. Only players do.', author: 'Phil Ivey' },
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
