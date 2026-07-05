/**
 * Feature flags — gate not-yet-fully-verified features so their code can ship dormant.
 * Flip to true only after the feature's verification requirements are met.
 */

/**
 * PRACTICE-TO-LIVE realtime jump. When FALSE (default): the lobby bot rows run pure LOCAL
 * practice — no join_table, no realtime seat-hold, no live=1, no countdown/jump. The Home
 * "Practice vs Bots" button fix and the practice session demo counter are INDEPENDENT of
 * this flag and stay active.
 *
 * Keep FALSE until a real 2-DEVICE pass verifies the cross-device 30s countdown sync + the
 * simultaneous cut-and-jump into /multiplayer-game + edges d/e live (a single client — or two
 * same-origin browser tabs — can't exercise these; the coordinator logic is unit-tested only).
 * See docs/PENDING_practice_to_live.md.
 */
export const PRACTICE_LIVE_ENABLED = false;
