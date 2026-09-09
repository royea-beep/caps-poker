/**
 * EMOTE PACKS — the six emoji on the multiplayer chat strip.
 *
 * WHY A SWAP AND NOT AN ADDITION. ChatOverlay's strip is a fixed `space-between` row of 34px
 * buttons documented to lay out "6 emotes + chat toggle" cleanly from 320 to 480px (Issue D).
 * Appending six more would put thirteen items on that row and overflow it at 320-375. A PACK of
 * six replaces a pack of six, so the layout is untouched — and "Emote pack" is what the catalogue
 * row has always been called.
 *
 * NOTHING IS TAKEN AWAY. CLASSIC below is the shipped set, byte-identical, and it stays the default
 * for everyone. Owning WILD adds a second pack and a picker to choose between them, so a buyer can
 * always go back — a purchase must never cost you something you had.
 */

export type EmotePackId = 'classic' | 'wild' | 'deadpan';

export interface EmotePack {
  id: EmotePackId;
  label: string;
  /** Catalogue event_type that unlocks it, or null when free to everyone. */
  sku: string | null;
  emotes: string[];
}

/** The shipped set, lifted verbatim from ChatOverlay's EMOTES. Free, and the default. */
const CLASSIC: EmotePack = {
  id: 'classic',
  label: 'CLASSIC',
  sku: null,
  emotes: ['😂', '💀', '🔥', '👏', '😤', '🤝'],
};

/**
 * WILD — unlocked by the existing `buy_emotes` row. Six again, deliberately: the count is a layout
 * constraint, not a style choice. Chosen to cover the same conversational range as CLASSIC (amused,
 * beaten, hot streak, applause, annoyed, good game) so switching packs never costs you a gesture.
 */
const WILD: EmotePack = {
  id: 'wild',
  label: 'WILD',
  sku: 'buy_emotes',
  emotes: ['🤯', '🫠', '🚀', '🧊', '🤝', '🐐'],
};

/**
 * DEADPAN — the second purchasable pack (SHIP-509), unlocked by `buy_emotes_deadpan`.
 *
 * SIX AGAIN, and covering the SAME six conversational slots as CLASSIC and WILD in the same order
 * (amused, beaten, hot streak, applause, annoyed, good game). That is not a style decision: the
 * count is a layout constraint, and holding the slots constant is what makes switching packs cost
 * you nothing. A pack that dropped "good game" would take a gesture away from whoever bought it.
 *
 * The register is dry rather than loud, which is the only thing that differs between the three.
 */
const DEADPAN: EmotePack = {
  id: 'deadpan',
  label: 'DEADPAN',
  sku: 'buy_emotes_deadpan',
  emotes: ['🙃', '😐', '📈', '🫡', '🥱', '🤷'],
};

export const EMOTE_PACKS: Record<EmotePackId, EmotePack> = { classic: CLASSIC, wild: WILD, deadpan: DEADPAN };
export const DEFAULT_EMOTE_PACK: EmotePackId = 'classic';
export const EMOTE_PACK_LIST: EmotePack[] = [CLASSIC, WILD, DEADPAN];

/** Resolve a pack, falling back to the default for an unknown or stale persisted id. */
export function getEmotePack(id: EmotePackId | null | undefined): EmotePack {
  return (id && EMOTE_PACKS[id]) || EMOTE_PACKS[DEFAULT_EMOTE_PACK];
}
