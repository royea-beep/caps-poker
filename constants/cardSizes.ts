/**
 * Card size constants — single source of truth for all card dimensions.
 * Community cards are ~1.5× hand cards for immediate visual hierarchy.
 */
import { rv } from '../utils/responsive';

export const CARD_SIZES = {
  /** Community cards — the stars of each board. Largest size. */
  community: {
    width: rv(56),
    height: rv(78),
    borderRadius: rv(6),
    fontSize: rv(22),
  },
  /** Player/bot cards placed on board slots. Medium size. */
  boardSlot: {
    width: rv(36),
    height: rv(50),
    borderRadius: rv(4),
    fontSize: rv(15),
  },
  /** Cards in player's hand (bottom area). Smallest size. */
  hand: {
    width: rv(32),
    height: rv(45),
    borderRadius: rv(4),
    fontSize: rv(13),
  },
  /** Cards in results/replay screens. */
  results: {
    width: rv(44),
    height: rv(62),
    borderRadius: rv(5),
    fontSize: rv(18),
  },
} as const;
