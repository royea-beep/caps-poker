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

/**
 * THE SWITCH. Roye asked for one and he was right to: the persistence fix stops the tips
 * NATURALLY once they have been read, but a player who wants them gone NOW should not have to
 * read six of them first. The two answer different questions and both are needed.
 *
 * ABSENT MEANS ON. A first-time player must still be taught — the tester round depends on a
 * stranger working the game out — so the flag is only ever written when someone deliberately
 * moves it, and "off" is never a default.
 */
export const TIPS_ENABLED_KEY = 'caps_show_tips';

/**
 * Must equal InteractiveTutorial's INTERACTIVE_TUTORIAL_KEY. Declared here rather than imported
 * so this module stays free of React: importing the component would drag the whole overlay into
 * every consumer. tipsSeen.test.ts asserts the two strings are identical, so they cannot drift.
 */
const ONBOARDING_SEEN_KEY = 'has_seen_interactive_tutorial';

/** Stable ids. The board hint is one of these too — it repeats on the same broken gate. */
export const gameTipId = (step: number) => `game-tip-${step}`;
export const BOARD_HINT_ID = 'board-hint';

let cache = new Set<string>();
let hydrated = false;
let inflight: Promise<Set<string>> | null = null;
let enabled = true;   // absent means ON — see TIPS_ENABLED_KEY

/** Resolves once the persisted set is in memory. Safe to call repeatedly. */
export function loadDismissedTips(): Promise<Set<string>> {
  if (hydrated) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = Promise.all([
    AsyncStorage.getItem(TIPS_DISMISSED_KEY),
    AsyncStorage.getItem(TIPS_ENABLED_KEY),
  ])
    .then(([raw, enabledRaw]) => {
      // Only an explicit 'false' turns them off. A missing key, a corrupt key and a stray value
      // all mean ON, so no storage accident can silently un-teach a new player.
      enabled = enabledRaw !== 'false';
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

/** Synchronous — for render. Defaults to ON before hydration, which errs toward TEACHING. */
export function areTipsEnabled(): boolean {
  return enabled;
}

/**
 * Moves the switch.
 *
 * Turning it back ON also clears every dismissal AND the onboarding-seen flag, so the
 * explanations genuinely come back. Without that the switch would work exactly once — off, then
 * on, then nothing, because everything is still marked seen — and a switch that only works in one
 * direction is not a switch.
 */
export async function setTipsEnabled(on: boolean): Promise<void> {
  enabled = on;
  hydrated = true;
  await AsyncStorage.setItem(TIPS_ENABLED_KEY, on ? 'true' : 'false').catch(() => {});
  if (on) {
    cache = new Set();
    await AsyncStorage.removeItem(TIPS_DISMISSED_KEY).catch(() => {});
    await AsyncStorage.removeItem(ONBOARDING_SEEN_KEY).catch(() => {});
  }
}

/** Synchronous — for render. False until hydration lands, which errs toward SHOWING a tip. */
export function isTipDismissed(id: string): boolean {
  // The switch is checked HERE, not at each call site, so every surface that already consults
  // this — the six tooltips and the board hint — is covered by one line and none can be missed.
  if (!enabled) return true;
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
  enabled = true;
}
