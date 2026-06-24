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
import { getAppVersion } from './analytics';

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

function report(message: string, stack?: string): void {
  if (!message) return;
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
        device: { platform: 'web', userAgent: ua },
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
