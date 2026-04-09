/**
 * Sound effects for Caps Poker.
 * Uses expo-audio (expo-av removed in S75).
 * S83: migrated from expo-av to expo-audio.
 */

export type SoundName =
  | 'cardPlace'
  | 'cardSelect'
  | 'cardFlip'
  | 'chipsWin'
  | 'lose'
  | 'complete'
  | 'timerLow'
  | 'buzzer'
  | 'revealStart'
  | 'boardWin'
  | 'boardLose';

let createAudioPlayer: ((source: any, options?: any) => any) | null = null;
let setAudioModeAsync: ((options: any) => Promise<void>) | null = null;
try {
  const expoAudio = require('expo-audio');
  createAudioPlayer = expoAudio.createAudioPlayer;
  setAudioModeAsync = expoAudio.setAudioModeAsync;
} catch {
  // expo-audio not available (web / build issue) â sounds disabled
}

const soundFiles: Record<SoundName, ReturnType<typeof require> | null> = {
  cardPlace: null,
  cardSelect: null,
  cardFlip: null,
  chipsWin: null,
  lose: null,
  complete: null,
  timerLow: null,
  buzzer: null,
  revealStart: null,
  boardWin: null,
  boardLose: null,
};

try { soundFiles.cardPlace  = require('../assets/sounds/cardPlace.wav');  } catch {}
try { soundFiles.cardSelect = require('../assets/sounds/cardSelect.wav'); } catch {}
try { soundFiles.cardFlip   = require('../assets/sounds/cardFlip.wav');   } catch {}
try { soundFiles.chipsWin   = require('../assets/sounds/chipsWin.wav');   } catch {}
try { soundFiles.lose       = require('../assets/sounds/lose.wav');       } catch {}
try { soundFiles.complete   = require('../assets/sounds/complete.wav');   } catch {}
try { soundFiles.timerLow   = require('../assets/sounds/timerLow.wav');   } catch {}
try { soundFiles.buzzer     = require('../assets/sounds/buzzer.wav');     } catch {}
try { soundFiles.revealStart = require('../assets/sounds/revealStart.wav'); } catch {}
try { soundFiles.boardWin   = require('../assets/sounds/boardWin.wav');   } catch {}
try { soundFiles.boardLose  = require('../assets/sounds/boardLose.wav');  } catch {}

// Pre-created players â fast playback, no async on each call
const players: Partial<Record<SoundName, any>> = {};

// S90: Volume levels â subtle background sounds
const VOLUME_MAP: Partial<Record<SoundName, number>> = {
  cardPlace: 0, cardSelect: 0, cardFlip: 0, // DISABLED — same sound 40x/game is annoying
  chipsWin: 0.4, lose: 0.4, boardWin: 0.4, boardLose: 0.4,
  revealStart: 0.3, timerLow: 0.4,
  complete: 0.7, buzzer: 0.5,
};

export async function preloadSounds(): Promise<void> {
  if (!createAudioPlayer) return;
  // Initialize audio session: play even when silent switch is on (iOS)
  if (setAudioModeAsync) {
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      });
    } catch {
      // Not supported in this environment â continue
    }
  }
  for (const [name, file] of Object.entries(soundFiles)) {
    if (!file) continue;
    try {
      players[name as SoundName] = createAudioPlayer!(file);
      try { players[name as SoundName].volume = VOLUME_MAP[name as SoundName] ?? 0.3; } catch {}
    } catch {
      // Sound file invalid or missing â skip
    }
  }
}

export async function playSound(name: SoundName): Promise<void> {
  try {
    // Dynamic import to avoid requiring the store module at import time in tests
    const { useGameStore } = require('../store/gameStore');
    const config = useGameStore.getState().config;
    if (!config.soundEnabled) return;

    const player = players[name];
    if (!player) return;

    try { player.seekTo(0); } catch {}
    player.play();
  } catch {
    // Silently ignore all audio errors
  }
}

// ─── Ambient sound — casino background loop ───────────────────────────────────
let ambientPlayer: any = null;
let ambientPlaying = false;

export async function startAmbient(): Promise<void> {
  if (!createAudioPlayer || ambientPlaying) return;
  try {
    let enabled = true;
    try {
      const AS = require('@react-native-async-storage/async-storage').default;
      const val = await AS.getItem('caps_ambient_enabled');
      if (val === 'false') enabled = false;
    } catch {}
    if (!enabled) return;
    let ambientFile: any = null;
    try { ambientFile = require('../assets/sounds/ambient.mp3'); } catch {}
    if (!ambientFile) return; // ambient.mp3 not yet present — infrastructure ready
    ambientPlayer = createAudioPlayer!(ambientFile);
    ambientPlayer.loop = true;
    ambientPlayer.volume = 0.15;
    ambientPlayer.play();
    ambientPlaying = true;
  } catch {}
}

export async function stopAmbient(): Promise<void> {
  if (ambientPlayer) {
    try { ambientPlayer.pause(); } catch {}
    ambientPlaying = false;
  }
}
