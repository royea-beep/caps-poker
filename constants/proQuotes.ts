export interface ProQuote {
  id: string;
  player: string;
  emoji: string;
  quote: string;
  context: 'home' | 'loading' | 'complete' | 'summary' | 'waiting' | 'tutorial';
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
  { id: 'dn1', player: 'Daniel Negreanu', emoji: '🇨🇦', quote: 'The most original poker mechanic since PLO', context: 'home', audioFile: VOICE_CLIPS.dn1 },
  { id: 'ph1', player: 'Phil Hellmuth', emoji: '👑', quote: 'I hate admitting it, but this is smart', context: 'home', audioFile: VOICE_CLIPS.ph1 },
  { id: 'pi1', player: 'Phil Ivey', emoji: '🃏', quote: 'Ship it.', context: 'home', audioFile: VOICE_CLIPS.pi1 },
  { id: 'ey2', player: 'Rampage', emoji: '📺', quote: 'Chess meets Omaha meets fantasy draft', context: 'home', audioFile: VOICE_CLIPS.ey2 },

  // WAITING FOR OPPONENT
  { id: 'mm1', player: 'Michael Mizrachi', emoji: '💪', quote: 'Deal again. NOW.', context: 'waiting', audioFile: VOICE_CLIPS.mm1 },
  { id: 'es1', player: 'Erik Seidel', emoji: '🎩', quote: 'First poker game in 10 years that surprised me', context: 'waiting', audioFile: VOICE_CLIPS.es1 },
  { id: 'jb1', player: 'Justin Bonomo', emoji: '🧮', quote: 'GTO implications are massive', context: 'waiting', audioFile: VOICE_CLIPS.jb1 },
  { id: 'bk2', player: 'Bryn Kenney', emoji: '💰', quote: '90 seconds. Perfect for quick games anywhere.', context: 'waiting', audioFile: VOICE_CLIPS.bk2 },

  // COMPLETE BONUS
  { id: 'ph2', player: 'Phil Hellmuth', emoji: '👑', quote: 'When I got COMPLETE I felt like I won a bracelet', context: 'complete', audioFile: VOICE_CLIPS.ph2 },
  { id: 'bk1', player: 'Bryn Kenney', emoji: '💰', quote: 'This is your Victory Royale moment', context: 'complete', audioFile: VOICE_CLIPS.bk1 },
  { id: 'ey1', player: 'Rampage', emoji: '📺', quote: 'COMPLETE = clips. Clips = views. Views = downloads.', context: 'complete', audioFile: VOICE_CLIPS.ey1 },
  { id: 'ck1', player: 'Chance Kornuth', emoji: '🎓', quote: 'COMPLETE mechanic = pure product genius', context: 'complete', audioFile: VOICE_CLIPS.ck1 },

  // SUMMARY SCREEN
  { id: 'dn2', player: 'Daniel Negreanu', emoji: '🇨🇦', quote: 'I forgot I was testing. I was just playing.', context: 'summary', audioFile: VOICE_CLIPS.dn2 },
  { id: 'mm2', player: 'Michael Mizrachi', emoji: '💪', quote: 'I want to play this for money. Right now.', context: 'summary', audioFile: VOICE_CLIPS.mm2 },
  { id: 'ph3', player: 'Phil Hellmuth', emoji: '👑', quote: 'I got angry when I lost. THAT is a good sign.', context: 'summary', audioFile: VOICE_CLIPS.ph3 },
  { id: 'ai1', player: 'Ali Imsirovic', emoji: '🌊', quote: 'Played 10 hands, wanted 10 more', context: 'summary', audioFile: VOICE_CLIPS.ai1 },

  // GAME SCREEN — tips during arrangement
  { id: 'dn3', player: 'Daniel Negreanu', emoji: '🇨🇦', quote: 'Stack one board or spread evenly? THAT is the question.', context: 'tutorial', audioFile: VOICE_CLIPS.dn3 },
  { id: 'pi2', player: 'Phil Ivey', emoji: '🃏', quote: 'You can read opponents through allocation patterns', context: 'tutorial', audioFile: VOICE_CLIPS.pi2 },
  { id: 'jb2', player: 'Justin Bonomo', emoji: '🧮', quote: 'Three strategies: stack-one, spread-even, read-and-counter', context: 'tutorial', audioFile: VOICE_CLIPS.jb2 },
  { id: 'ck2', player: 'Chance Kornuth', emoji: '🎓', quote: 'Build your ENTIRE strategy around chasing COMPLETE', context: 'tutorial', audioFile: VOICE_CLIPS.ck2 },
];

export function getRandomQuote(context: ProQuote['context']): ProQuote {
  const filtered = PRO_QUOTES.filter(q => q.context === context);
  return filtered[Math.floor(Math.random() * filtered.length)];
}
