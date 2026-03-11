/**
 * Sound effects infrastructure for Caps Poker.
 * Uses expo-av when available, silently no-ops when not.
 * Sound files go in assets/sounds/ — see README.txt there.
 */

export type SoundName = 'cardPlace' | 'cardFlip' | 'chipsWin' | 'complete';

let Audio: any = null;
try {
  Audio = require('expo-av').Audio;
} catch {
  // expo-av not available (e.g. web or build issue) — sounds disabled
}

const soundFiles: Record<SoundName, ReturnType<typeof require> | null> = {
  cardPlace: null,
  cardFlip: null,
  chipsWin: null,
  complete: null,
};

// Try to load sound files — they may not exist yet
try { soundFiles.cardPlace = require('../assets/sounds/cardPlace.mp3'); } catch {}
try { soundFiles.cardFlip = require('../assets/sounds/cardFlip.mp3'); } catch {}
try { soundFiles.chipsWin = require('../assets/sounds/chipsWin.mp3'); } catch {}
try { soundFiles.complete = require('../assets/sounds/complete.mp3'); } catch {}

const loadedSounds: Partial<Record<SoundName, any>> = {};

export async function preloadSounds(): Promise<void> {
  if (!Audio) return;
  for (const [name, file] of Object.entries(soundFiles)) {
    if (!file) continue;
    try {
      const { sound } = await Audio.Sound.createAsync(file);
      loadedSounds[name as SoundName] = sound;
    } catch {
      // Sound file missing or invalid — skip silently
    }
  }
}

export async function playSound(name: SoundName): Promise<void> {
  try {
    // Dynamic import to avoid requiring the store module at import time in tests
    const { useGameStore } = require('../store/gameStore');
    const config = useGameStore.getState().config;
    if (!config.soundEnabled) return;

    const sound = loadedSounds[name];
    if (!sound) return;

    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch {
    // Silently ignore all audio errors
  }
}
