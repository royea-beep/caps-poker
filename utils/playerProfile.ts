/**
 * playerProfile.ts — thin helpers for player name + avatar.
 * Data lives in gameStore (persisted via AsyncStorage).
 */
import { useGameStore } from '../store/gameStore';

export const AVATAR_OPTIONS = ['🎰', '🃏', '🎲', '🦁', '🐯', '🦊', '🐺', '🦅', '👑', '💀', '🔥', '⚡'];

/**
 * THREE-FAMILIES — the avatars the existing `buy_avatar` catalogue row unlocks.
 *
 * ADDITIVE ONLY. AVATAR_OPTIONS above is untouched, byte for byte, and stays free to everyone: a
 * player who owns nothing sees exactly the twelve they see today. These twelve are extra, and they
 * are the only thing the purchase grants.
 */
export const AVATAR_OPTIONS_PREMIUM = ['🐉', '🦈', '🦂', '🕷', '🐍', '🦇', '🎩', '💎', '🪙', '🏆', '🥷', '🤖'];

/** Catalogue row that unlocks AVATAR_OPTIONS_PREMIUM. */
export const AVATAR_PREMIUM_SKU = 'buy_avatar';

/** The avatars a device may actually choose from, given what it owns. */
export function avatarOptionsFor(ownedSkus: readonly string[]): string[] {
  return ownedSkus.includes(AVATAR_PREMIUM_SKU)
    ? [...AVATAR_OPTIONS, ...AVATAR_OPTIONS_PREMIUM]
    : AVATAR_OPTIONS;
}
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
