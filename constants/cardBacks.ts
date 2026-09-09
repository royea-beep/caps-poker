/**
 * CARD BACKS — the palette table for the face-down card.
 *
 * Until now there was exactly ONE back, hardcoded as five constants inside Card.tsx, which is
 * Roye's C5: every card back in the game looks identical. This file makes the back a lookup so a
 * second one can exist, and it is the whole mechanism — Card.tsx resolves a palette from here the
 * same way it already resolves the card FACE from cardTheme.
 *
 * THE COLOUR MAP IS NOT NEGOTIABLE, and it is why every value below is a grey:
 *   gold  -> WON, and nothing else. The winner cue owns it.
 *   mint  -> the field (community frames).
 *   white -> neutral chrome, carries no state.
 * The back used to wear gold and it collided head-on with the winner highlight — one mark for two
 * opposite states. It was made neutral deliberately. A purchasable back must not undo that, so a
 * variant may differ in LUMINANCE and PATTERN but never in hue.
 *
 * NO INFORMATION LEAK, BY CONSTRUCTION: a palette is chosen by the card's OWNER and applied to
 * every one of their face-down cards identically. Nothing here is derived from the card's rank,
 * suit or value — renderBack() never receives the card at all.
 */

export type CardBackId = 'classic' | 'slate' | 'graphite';

export interface CardBackPalette {
  id: CardBackId;
  /** Shown in the picker. */
  label: string;
  /** Catalogue event_type that unlocks it, or null when it is free to everyone. */
  sku: string | null;
  bg: string;
  /** The "C" glyph. */
  glyph: string;
  /** Inner concentric ring(s). */
  ring: string;
  /** Inset edge ring. */
  edge: string;
  /** Soft glow behind the glyph. */
  glow: string;
  /**
   * How many concentric rings to draw. This is the hue-independent second channel: two backs that
   * differ only in luminance are weak in greyscale, and greyscale is the accessibility floor this
   * project measures against.
   */
  rings: 1 | 2 | 3;
}

/**
 * The shipped default, unchanged to the byte — every value here was lifted from the constants it
 * replaces in Card.tsx. It stays free for everyone; nobody loses the back they have today.
 */
const CLASSIC: CardBackPalette = {
  id: 'classic',
  label: 'CLASSIC',
  sku: null,
  bg: '#18181c',
  glyph: 'rgba(255,255,255,0.45)',
  ring: 'rgba(255,255,255,0.16)',
  edge: 'rgba(255,255,255,0.18)',
  glow: 'rgba(255,255,255,0.22)',
  rings: 1,
};

/**
 * SLATE — the first purchasable back, unlocked by the existing `buy_card_back` catalogue row.
 *
 * A lighter charcoal, still clearly a BACK and not a face (faces are warm near-white, #FFFEF8 —
 * this sits far below that, so face-up and face-down never read alike), plus a second concentric
 * ring so it separates without relying on luminance alone.
 */
const SLATE: CardBackPalette = {
  id: 'slate',
  label: 'SLATE',
  sku: 'buy_card_back',
  bg: '#4A5058',
  glyph: 'rgba(255,255,255,0.66)',
  ring: 'rgba(255,255,255,0.24)',
  edge: 'rgba(255,255,255,0.30)',
  glow: 'rgba(255,255,255,0.26)',
  rings: 2,
};

/**
 * GRAPHITE — the second purchasable back (SHIP-509), unlocked by `buy_card_back_graphite`.
 *
 * IT OBEYS THE SAME THREE RULES AS SLATE, AND THEY ARE THE REASON IT LOOKS LIKE THIS:
 *
 *  1. NO HUE. Every channel is a neutral grey. Gold means WON and mint means the field; a back
 *     that borrowed either would put one mark on two opposite states, which is exactly the
 *     collision the original gold back was removed for. The winner cue keeps gold to itself.
 *  2. NO INFORMATION LEAK, BY CONSTRUCTION. renderBack() is never passed the card, so nothing
 *     here can vary by rank or suit. A back is chosen by its OWNER and drawn identically on every
 *     one of their face-down cards.
 *  3. NOT MISTAKEABLE FOR A FACE. Faces are warm near-white (#FCFAF3); #2E3238 sits far below
 *     that, so face-up and face-down never read alike at a glance.
 *
 * It separates from BOTH shipped backs on TWO channels, not one — luminance (#18181c < #2E3238 <
 * #4A5058) and ring count (1 / 3 / 2). Luminance alone is weak in greyscale, and greyscale is the
 * accessibility floor this project measures against.
 */
const GRAPHITE: CardBackPalette = {
  id: 'graphite',
  label: 'GRAPHITE',
  sku: 'buy_card_back_graphite',
  bg: '#2E3238',
  glyph: 'rgba(255,255,255,0.56)',
  ring: 'rgba(255,255,255,0.20)',
  edge: 'rgba(255,255,255,0.24)',
  glow: 'rgba(255,255,255,0.24)',
  rings: 3,
};

export const CARD_BACKS: Record<CardBackId, CardBackPalette> = {
  classic: CLASSIC,
  slate: SLATE,
  graphite: GRAPHITE,
};

export const DEFAULT_CARD_BACK: CardBackId = 'classic';

/** Every back in picker order — free first. */
export const CARD_BACK_LIST: CardBackPalette[] = [CLASSIC, SLATE, GRAPHITE];

/**
 * Resolve a palette, falling back to the default for an unknown id. Card.tsx renders on every
 * frame of a deal, so this must never throw on a stale persisted value.
 */
export function getCardBack(id: CardBackId | null | undefined): CardBackPalette {
  return (id && CARD_BACKS[id]) || CARD_BACKS[DEFAULT_CARD_BACK];
}

/**
 * The back a player may actually use, given what they own. A back with a `sku` requires that sku;
 * a free back is always allowed. Used to gate the picker AND to fall back if a persisted choice is
 * no longer owned — the selection must never outlive the entitlement.
 */
export function isCardBackUnlocked(back: CardBackPalette, ownedSkus: readonly string[]): boolean {
  return back.sku === null || ownedSkus.includes(back.sku);
}
