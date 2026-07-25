/**
 * AUTO-LEARN 2026-07-06 — passive friction signals, captured automatically with no user
 * action required. 49 testers, 0 bug reports: we were blind to friction (the responsive
 * break was only caught via a WhatsApp screenshot). These fire to `analytics_events` so
 * breakage shows up in telemetry before someone has to notice and report it by hand.
 *
 * - rage_tap: 3+ taps within a small radius inside 1s — a dead/confusing control (this
 *   would have caught the Play Online dead-first-tap automatically).
 * - screen_abandon: left a screen within 3s of arriving with zero interaction — confusion
 *   or a screen that looks broken enough to bounce off immediately.
 * - stuck_dwell: 30s+ on a screen with zero interaction — they don't know what to do next.
 *
 * Wired into app/_layout.tsx: `recordGlobalTap` from a non-claiming root-level
 * `onStartShouldSetResponderCapture` (observes every touch app-wide without intercepting
 * it — returns false so gesture handling / presses continue exactly as before), and
 * `onScreenChanged` from the existing pathname-change effect.
 */
import { track } from './analytics';

const RAGE_TAP_RADIUS_PX = 40;
const RAGE_TAP_WINDOW_MS = 1000;
const RAGE_TAP_THRESHOLD = 3;
// Cooldown after firing so one mashing session reports once, not once per extra tap.
const RAGE_TAP_COOLDOWN_MS = 2000;

const SCREEN_ABANDON_MS = 3000;
const STUCK_DWELL_MS = 30000;

interface TapRecord { x: number; y: number; t: number; }

let recentTaps: TapRecord[] = [];
let lastRageTapFiredAt = 0;

let currentScreen = '';
let screenEnteredAt = 0;
let screenHadInteraction = false;
let stuckDwellTimer: ReturnType<typeof setTimeout> | null = null;

/** Call from a non-claiming global touch observer (onStartShouldSetResponderCapture). */
export function recordGlobalTap(x: number, y: number): void {
  const t = Date.now();
  screenHadInteraction = true;

  recentTaps.push({ x, y, t });
  recentTaps = recentTaps.filter((tap) => t - tap.t <= RAGE_TAP_WINDOW_MS);

  if (t - lastRageTapFiredAt < RAGE_TAP_COOLDOWN_MS) return;

  const cluster = recentTaps.filter((tap) => Math.hypot(tap.x - x, tap.y - y) <= RAGE_TAP_RADIUS_PX);
  if (cluster.length >= RAGE_TAP_THRESHOLD) {
    lastRageTapFiredAt = t;
    track('rage_tap', {
      x: Math.round(x),
      y: Math.round(y),
      tapCount: cluster.length,
      windowMs: RAGE_TAP_WINDOW_MS,
    }, currentScreen);
    recentTaps = [];
  }
}

/** Call whenever the route/screen changes (pathname effect in app/_layout.tsx). */
export function onScreenChanged(newScreen: string): void {
  const t = Date.now();

  if (stuckDwellTimer) { clearTimeout(stuckDwellTimer); stuckDwellTimer = null; }

  if (currentScreen && screenEnteredAt) {
    const dwellMs = t - screenEnteredAt;
    if (dwellMs < SCREEN_ABANDON_MS && !screenHadInteraction) {
      track('screen_abandon', { dwellMs }, currentScreen);
    }
  }

  currentScreen = newScreen;
  screenEnteredAt = t;
  screenHadInteraction = false;

  // AUTONOMOUS-HARDENING — never arm/emit against an empty screen (cold-start window before the
  // first usePathname resolves). The server coalesces an empty screen to '?', so this defensively
  // guarantees every stuck_dwell carries a real route.
  if (newScreen) {
    stuckDwellTimer = setTimeout(() => {
      if (!screenHadInteraction && currentScreen === newScreen) {
        track('stuck_dwell', { dwellMs: STUCK_DWELL_MS }, newScreen);
      }
    }, STUCK_DWELL_MS);
  }
}
