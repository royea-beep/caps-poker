/**
 * A TIP THE PLAYER HAS ALREADY BEEN SHOWN STAYS DISMISSED — PER DEVICE, FOR EVER.
 *
 * WHY THIS FILE EXISTS. The first-hand explanations were gated on `caps_games_played === 0`.
 * That counter has exactly one writer in the codebase — app/game.tsx's reveal-done handler — so
 * it counts HANDS FINISHED. The tips are asking a different question: "have you been shown this
 * before?" A player who opens a hand, reads the six tips and leaves without finishing has been
 * shown them, and the counter has not moved. Next hand: all six again. And again.
 *
 * MEASURED, not assumed (tests/tips-abandon.mjs, 2026-09-06): four hands opened and abandoned in
 * a row, tips on every one, `caps_games_played` still null at the end. That is the whole
 * complaint — "sometimes it's really annoying" is the abandoned-hand path, and it repeats for
 * ever. Finish one hand and they stop correctly; that half was never broken.
 *
 * So the flag moves to the event that actually matters: the tip being SEEN AND DISMISSED. No new
 * setting, and the annoyance goes away for every player rather than for the ones who find a
 * toggle. A first-time player still gets every tip — nothing is dismissed until they dismiss it.
 *
 * SYNCHRONOUS READS ON PURPOSE. These are consulted inside render. The set is hydrated once from
 * AsyncStorage at module load and kept in memory; before that resolves `isTipDismissed` returns
 * false, so the worst case is a brand-new-looking first render, never a tip wrongly suppressed.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const TIPS_DISMISSED_KEY = 'caps_tips_dismissed';

/** Stable ids. The board hint is one of these too — it repeats on the same broken gate. */
export const gameTipId = (step: number) => `game-tip-${step}`;
export const BOARD_HINT_ID = 'board-hint';

let cache = new Set<string>();
let hydrated = false;
let inflight: Promise<Set<string>> | null = null;

/** Resolves once the persisted set is in memory. Safe to call repeatedly. */
export function loadDismissedTips(): Promise<Set<string>> {
  if (hydrated) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = AsyncStorage.getItem(TIPS_DISMISSED_KEY)
    .then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) cache = new Set(parsed.map(String));
        } catch {
          // A corrupt value must not permanently silence onboarding for a new player, so it is
          // treated as "nothing dismissed yet" rather than swallowed into an unknown state.
        }
      }
      hydrated = true;
      return cache;
    })
    .catch(() => { hydrated = true; return cache; });
  return inflight;
}

/** Synchronous — for render. False until hydration lands, which errs toward SHOWING a tip. */
export function isTipDismissed(id: string): boolean {
  return cache.has(id);
}

/** Records a dismissal. In memory immediately so the current render is correct; persisted after. */
export function markTipDismissed(id: string): void {
  if (cache.has(id)) return;
  cache.add(id);
  AsyncStorage.setItem(TIPS_DISMISSED_KEY, JSON.stringify([...cache])).catch(() => {});
}

/**
 * Clears every dismissal — used ONLY by the existing "Show tutorial" replay in Settings and the
 * side menu. Replaying the onboarding should teach the whole thing again, tips included;
 * otherwise the replay is a half-replay and the player wonders where the rest went.
 */
export async function resetDismissedTips(): Promise<void> {
  cache = new Set();
  hydrated = true;
  await AsyncStorage.removeItem(TIPS_DISMISSED_KEY).catch(() => {});
}

/** Test seam. Not used by the app. */
export function __resetTipsCacheForTest(): void {
  cache = new Set();
  hydrated = false;
  inflight = null;
}
