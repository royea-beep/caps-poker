/**
 * playerProfile.ts — thin helpers for player name + avatar.
 * Data lives in gameStore (persisted via AsyncStorage).
 */
import { useGameStore } from '../store/gameStore';

export const AVATAR_OPTIONS = ['🎰', '🃏', '🎲', '🦁', '🐯', '🦊', '🐺', '🦅', '👑', '💀', '🔥', '⚡'];
export const DEFAULT_AVATAR = '🎰';
export const DEFAULT_NAME = 'Player 1';

export interface PlayerProfile {
  name: string;
  avatar: string;
}

/** Read the current profile from the store (synchronous — store is hydrated). */
export function getPlayerProfile(): PlayerProfile {
  const state = useGameStore.getState();
  return {
    name: state.playerName || DEFAULT_NAME,
    avatar: state.playerAvatar || DEFAULT_AVATAR,
  };
}

/** Persist name + avatar to the store. */
export function savePlayerProfile(name: string, avatar: string): void {
  const { setPlayerName, setPlayerAvatar } = useGameStore.getState();
  setPlayerName(name.trim().slice(0, 20) || DEFAULT_NAME);
  setPlayerAvatar(avatar || DEFAULT_AVATAR);
}
