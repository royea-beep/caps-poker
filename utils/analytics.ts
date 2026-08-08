import AsyncStorage from '@react-native-async-storage/async-storage';
/**
 * Supabase-based analytics. Uses track_event RPC — no external SDK.
 * Fire-and-forget: never blocks UI, never throws.
 *
 * VAMOS-CAPS-PRE-FRIENDS-READINESS 2026-06-24 — RE-ACTIVATED.
 * track() was a no-op since 2026-06-17 because the track_event RPC 404'd. That RPC
 * now exists (track_event(p_event, p_user_id, p_device_id, p_data, p_screen) ->
 * analytics_events), so tracking is restored: every screen_view / mode_start /
 * game_start / game_end / purchase / cup_earned / error callsite across the app
 * lights up again. session_id + app_version ride along in properties (the RPC has
 * no dedicated session_id arg), and every event also feeds a per-session breadcrumb
 * trail that the crash/error reporters attach so a bug arrives with its last steps.
 */
import { getDeviceId } from './leaderboard';
import { addBreadcrumb } from './breadcrumbs';
import { getCurrentScreen } from './crash-evidence';

let cachedDeviceId: string | null = null;
let cachedUserId: string | null = null;
let cachedSessionId: string | null = null;
let cachedAppVersion = 'unknown';
let supabaseRef: any = null;

function generateSessionId(): string {
  // RFC 4122 v4 — adequate for in-memory analytics session IDs (not used for security).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function getSessionId(): string | null {
  return cachedSessionId;
}

export function getAppVersion(): string {
  return cachedAppVersion;
}

/**
 * G2 / BUILD TRACEABILITY 2026-08-08 — WHICH BUILD produced this row.
 *
 * `app_version` is `expoConfig.version` = "2.7.0" on EVERY row across three months and 100+
 * builds, so no crash or analytics row could be attributed to a build. This adds the number
 * that actually differs.
 *
 * READ FROM THE NATIVE LAYER, NOT THE JS BUNDLE. `Application.nativeBuildVersion` is the
 * installed binary's CFBundleVersion, so a JS bundle that outlives its build (OTA, or a stale
 * cached bundle) still reports the build it is RUNNING ON. The JS-side alternatives are both
 * known-wrong: `expoConfig.ios.buildNumber` is what the bundle THINKS, and
 * `expoConfig.extra.buildNumber` is a hand-maintained field that is currently "330" while the
 * shipped binary is 508 — the exact drift that made the in-app build number unreliable.
 *
 * Web has no native build, so this is null there and says so rather than substituting
 * something plausible-looking.
 *
 * Memoised; expo-application reads are synchronous constants.
 */
let _buildIdentity: Record<string, unknown> | null = null;
export function getBuildIdentity(): Record<string, unknown> {
  if (_buildIdentity) return _buildIdentity;
  try {
    const App = require('expo-application');
    _buildIdentity = {
      // iOS CFBundleVersion / Android versionCode, from the installed binary.
      native_build: App?.nativeBuildVersion ?? null,
      native_version: App?.nativeApplicationVersion ?? null,
    };
  } catch {
    _buildIdentity = { native_build: null, native_version: null };
  }
  return _buildIdentity;
}

export async function initAnalytics(): Promise<void> {
  try {
    cachedDeviceId = await getDeviceId();
    cachedSessionId = generateSessionId();
    await loadPendingFailures();
    try {
      cachedAppVersion = require('expo-constants').default?.expoConfig?.version ?? 'unknown';
    } catch {}
    const { getSupabase } = require('./supabase');
    supabaseRef = getSupabase();
    const { data } = await supabaseRef.auth.getUser();
    cachedUserId = data?.user?.id ?? null;
  } catch {}
}

/**
 * Fire an analytics event (fire-and-forget). Writes to analytics_events via the
 * track_event RPC and records a breadcrumb. Never throws, never blocks the UI.
 */

// AN1 — CLIENT FINGERPRINT. We spent three sprints unable to answer "who is visiting" because
// nothing captured it: analytics_events has no UA/referrer/IP, and caps-poker-web is a STATIC Expo
// export with no serverless functions, so Vercel runtime logs never contain user agents either.
// This is the cheapest instrument we fully control. Computed ONCE (module scope, lazy) so it costs
// nothing per event, and wrapped so a missing global can never break analytics.
let _fp: Record<string, unknown> | null = null;
function clientFingerprint(): Record<string, unknown> {
  if (_fp) return _fp;
  try {
    const nav: any = typeof navigator !== 'undefined' ? navigator : null;
    const scr: any = typeof screen !== 'undefined' ? screen : null;
    _fp = {
      // Truncated: this rides in properties, not a column, and full UAs are long and noisy.
      ua: nav?.userAgent ? String(nav.userAgent).slice(0, 180) : null,
      // navigator.webdriver is TRUE for Playwright/Puppeteer/Selenium — the most direct bot tell
      // available to a client, and the single field this whole change exists for.
      webdriver: nav?.webdriver === true,
      sw: scr?.width ?? null,
      sh: scr?.height ?? null,
      // Headless defaults (800x600, DPR 1) are distinctive against real devices.
      dpr: typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : null,
    };
  } catch {
    _fp = { ua: null, webdriver: null, sw: null, sh: null, dpr: null };
  }
  return _fp;
}


// AV1 — SELF-DIAGNOSING TRANSPORT. `.catch(() => {})` below swallows every delivery failure by
// design (analytics must never break the app), which means a device whose sends never arrive looks
// identical to a device that is simply idle. That is exactly the ambiguity blocking the iOS
// diagnosis: 41 of 43 devices emit four events from one mount and nothing after.
//
// So: count failures, PERSIST the count, and attach it to the next SUCCESSFUL send. No new request,
// one extra field on an event already going out.
//
// PERSISTED, not in-memory, deliberately: the case we care about is an app killed with sends
// outstanding, and an in-memory counter dies with it.
const FAILED_SENDS_KEY = 'caps_failed_sends';
const LAST_FAILURE_KEY = 'caps_last_send_failure';
let pendingFailures = 0;   // mirror, so a success can attach without awaiting a read
let lastFailureAt = 0;     // ms epoch mirror, so ms_since_last_failure is computable synchronously

function noteSendFailure(): void {
  pendingFailures += 1;
  // Fire-and-forget write. PROCESS-DEATH CAVEAT: if the app is killed between the failed send and
  // this write completing, the increment is lost — we under-count rather than over-count, which is
  // the safe direction (we never invent failures). The mirror above also dies, so the loss is one
  // count, not a corrupted total.
  try {
    AsyncStorage.setItem(FAILED_SENDS_KEY, String(pendingFailures)).catch(() => {});
    lastFailureAt = Date.now();
    AsyncStorage.setItem(LAST_FAILURE_KEY, String(lastFailureAt)).catch(() => {});
  } catch { /* never throw from analytics */ }
}

/** Load any counter that survived a previous process. Called from initAnalytics. */
async function loadPendingFailures(): Promise<void> {
  try {
    const v = await AsyncStorage.getItem(FAILED_SENDS_KEY);
    const n = v ? parseInt(v, 10) : 0;
    if (Number.isFinite(n) && n > 0) pendingFailures = n;
    const t = await AsyncStorage.getItem(LAST_FAILURE_KEY);
    const ts = t ? parseInt(t, 10) : 0;
    if (Number.isFinite(ts) && ts > 0) lastFailureAt = ts;
  } catch { /* ignore */ }
}

/** Peek only — must NOT reset, because we do not yet know whether THIS send will arrive. */
function peekFailureReport(): Record<string, unknown> {
  if (pendingFailures <= 0) return {};
  const n = pendingFailures;
  const out: Record<string, unknown> = {
    failed_sends: n,
    ms_since_last_failure: lastFailureAt ? Date.now() - lastFailureAt : null,
  };
  return out;
}

/** Reset ONLY after a send is confirmed delivered. */
function commitFailureDrain(reported: Record<string, unknown>): void {
  if (!('failed_sends' in reported)) return;
  pendingFailures = 0;
  try { AsyncStorage.setItem(FAILED_SENDS_KEY, '0').catch(() => {}); } catch { /* ignore */ }
}

export function track(event: string, properties?: Record<string, unknown>, screen?: string): void {
  // Feed the shared breadcrumb trail (utils/breadcrumbs) that crash/bug reports
  // already attach — record even if the network call below later fails.
  addBreadcrumb(screen ? `${event} @${screen}` : event);
  try {
    const sb = supabaseRef ?? (() => { try { return require('./supabase').getSupabase(); } catch { return null; } })();
    if (!sb) return;
    const failureReport = peekFailureReport();
    sb.rpc('track_event', {
      p_event: event,
      p_user_id: cachedUserId,
      p_device_id: cachedDeviceId,
      p_data: {
        ...(properties ?? {}),
        // session_id/app_version travel in properties: the RPC has no dedicated args.
        session_id: cachedSessionId,
        app_version: cachedAppVersion,
        // G2 — app_version alone cannot identify a build (it is "2.7.0" everywhere).
        ...getBuildIdentity(),
        ...clientFingerprint(),
        ...failureReport,
      },
      // FRICTION-NULL-SCREEN 2026-07-25 — never transmit a null/empty screen. When a caller omits it
      // (the cold-start window before the route tag initialises), fall back to the globally-maintained
      // route (crash-evidence, kept current per-route since f7a66f7). getCurrentScreen() defaults to
      // 'unknown' — never null/empty — so p_screen is ALWAYS a real screen. Guarantees every
      // stuck_dwell/rage_tap/any event carries a screen, at the transmission boundary itself.
      p_screen: screen || getCurrentScreen(),
    }).then(({ error }: { error: unknown }) => {
      // AV1 FIX: supabase-js RESOLVES with { data, error } on a transport failure — it does NOT
      // reject. The previous `.catch(noteSendFailure)` was therefore DEAD CODE and the counter could
      // never increment. Same shape as record_chip_purchase's PERFORM discarding earn_chips' result:
      // a failure path that reported success.
      if (error) { noteSendFailure(); return; }
      commitFailureDrain(failureReport);
    }).catch(() => { noteSendFailure(); });
  } catch {
    // never throw from analytics
  }
}

export function trackPushOpen(templateType: string): void {
  if (!supabaseRef || !cachedUserId) return;
  supabaseRef.rpc('track_push_open', {
    p_user_id: cachedUserId,
    p_template_type: templateType,
  }).then(() => {}).catch(() => {});
}
