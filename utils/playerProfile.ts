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

/**
 * MYTHIC — the second purchasable avatar set (SHIP-509), unlocked by `buy_avatar_mythic`.
 *
 * ADDITIVE, LIKE THE FIRST. AVATAR_OPTIONS and AVATAR_OPTIONS_PREMIUM are untouched byte for
 * byte. A player who owns nothing still sees exactly the same twelve they see today; a player who
 * owns the first set still sees exactly the same twenty-four. Nothing anyone has becomes paid.
 *
 * Twelve again — the picker's grid is four across, so the count has to stay a multiple of four or
 * the last row goes ragged.
 */
export const AVATAR_OPTIONS_MYTHIC = ['🐙', '🦉', '🦋', '🌙', '☄️', '🔱', '⚜️', '🗝', '🧿', '🕯', '🪬', '🜲'];

/** Catalogue row that unlocks AVATAR_OPTIONS_MYTHIC. */
export const AVATAR_MYTHIC_SKU = 'buy_avatar_mythic';

/** The avatars a device may actually choose from, given what it owns. Both sets are independent. */
export function avatarOptionsFor(ownedSkus: readonly string[]): string[] {
  return [
    ...AVATAR_OPTIONS,
    ...(ownedSkus.includes(AVATAR_PREMIUM_SKU) ? AVATAR_OPTIONS_PREMIUM : []),
    ...(ownedSkus.includes(AVATAR_MYTHIC_SKU) ? AVATAR_OPTIONS_MYTHIC : []),
  ];
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
