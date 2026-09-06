/**
 * Web global error reporter — VAMOS-CAPS-PRE-FRIENDS-READINESS 2026-06-24.
 *
 * The native crash pipeline (crash-evidence dashcam + crashDetector video +
 * ErrorUtils.setGlobalHandler) is gated to native; on WEB (caps.ftable.co.il —
 * what friends play) uncaught JS errors and promise rejections were captured
 * nowhere. This attaches window 'error' + 'unhandledrejection' listeners and
 * writes each to crash_reports (the only telemetry table with a public INSERT
 * policy) WITH the per-session breadcrumb trail, screen, app_version and UA, so a
 * friend's bug arrives with the steps that led to it.
 *
 * Fire-and-forget, throttled (no spam), never throws.
 */
import { Platform } from 'react-native';
import { getSupabase } from './supabase';
import { getBreadcrumbs } from './breadcrumbs';
import { getAppVersion, getBuildIdentity } from './analytics';
import { getDeviceId, getCachedDeviceId } from './leaderboard';

let installed = false;
let lastSentAt = 0;
let lastMessage = '';
const THROTTLE_MS = 5000;

function crashCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += chars[(Math.random() * chars.length) | 0];
  return `CRW-${s}`;
}

/**
 * Non-actionable rejections that must NOT be logged as crashes. The browser autoplay
 * policy rejects audio play() before a user gesture; expo-audio's web player.play()
 * doesn't return the rejecting promise, so it can't be caught at the call site and always
 * surfaces as an unhandledrejection (different wording per browser: Chrome "play() failed
 * … didn't interact", iOS/Safari "not allowed by the user agent or the platform"). Audio
 * is non-essential, so these are noise — they were flooding crash_reports from MP games.
 */
function isBenign(message: string, stack?: string): boolean {
  const m = (message || '').toLowerCase();
  const s = (stack || '').toLowerCase();
  if (
    m.includes('play() failed') ||
    m.includes("didn't interact") ||
    m.includes('the request is not allowed by the user agent') ||
    m.includes('notallowederror') ||
    s.includes('playsound') ||
    s.includes('expo-audio') ||
    // PRE-INVITE 2026-09-06 — the newest live crash row, and the same class as the four above:
    // pausing audio while its play() promise is still pending rejects with this exact wording.
    // Non-actionable, and it fires on every navigation away from a screen with a sound.
    m.includes('play() request was interrupted')
  ) return true;
  // ResizeObserver loop notifications are benign browser messages, not errors.
  if (m.includes('resizeobserver loop')) return true;
  return false;
}

function report(message: string, stack?: string): void {
  if (!message) return;
  if (isBenign(message, stack)) return;
  const now = Date.now();
  // De-dupe identical errors + cap frequency so a render loop can't flood the table.
  if (message === lastMessage && now - lastSentAt < THROTTLE_MS) return;
  lastMessage = message;
  lastSentAt = now;

  try {
    const sb = getSupabase();
    if (!sb) return;
    const crumbs = getBreadcrumbs();
    const lastScreen = crumbs.length ? crumbs[crumbs.length - 1].screen : 'unknown';
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'web';
    sb.from('crash_reports')
      .insert({
        crash_code: crashCode(),
        project: 'Caps',
        version: getAppVersion(),
        error_message: message.slice(0, 2000),
        error_stack: stack ? stack.slice(0, 6000) : null,
        last_screen: lastScreen,
        last_action: crumbs.length ? crumbs[crumbs.length - 1].screen : 'unknown',
        step_log: crumbs,
        console_errors: [],
        // G2 2026-08-08 — `version` above is "2.7.0" on every build ever shipped, so a crash
        // row could not be traced to a build. The native build number rides in `device`, which
        // is an existing jsonb column, so this needs no migration.
        device: { platform: 'web', userAgent: ua, ...getBuildIdentity() },
        // PRE-INVITE 2026-09-06 — `device_id` was NULL on all 350 crash rows, 191 of them written
        // right here. The other two crash writers (crash-evidence, notifications) have set it
        // since AU2.1; this one never did, so a web crash could not be joined to the device's
        // analytics_events, its bug reports, or its session — which is the whole point of having
        // the column. Read from the cache warmed in initWebErrorReporter(): this handler must
        // stay synchronous, so it cannot await.
        device_id: getCachedDeviceId(),
        status: 'new',
      })
      .then(() => {}, () => {});
  } catch {
    // never throw from the error reporter
  }
}

export function initWebErrorReporter(): void {
  if (installed || Platform.OS !== 'web') return;
  if (typeof window === 'undefined' || !window.addEventListener) return;
  installed = true;

  // Warm the device-id cache so report() can read it synchronously. Fire-and-forget: the
  // reporter must never depend on this resolving, and a crash before it does writes null.
  void getDeviceId().catch(() => {});

  window.addEventListener('error', (e: any) => {
    const msg = e?.message || e?.error?.message || 'Uncaught error';
    report(String(msg), e?.error?.stack);
  });
  window.addEventListener('unhandledrejection', (e: any) => {
    const reason = e?.reason;
    const msg = reason?.message || (typeof reason === 'string' ? reason : 'Unhandled promise rejection');
    report(`Unhandled rejection: ${msg}`, reason?.stack);
  });
}
