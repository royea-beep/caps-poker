/**
 * Single source of truth for shareable app links (S70).
 *
 * Every invite share builds its URL through buildInviteUrl(), so when native
 * universal / deep links are added later only APP_WEB_BASE (and the native link
 * config) changes — call sites stay untouched. The web route app/invite/[code].tsx
 * handles the /invite/<code> path today; the same URL can front a native deep link
 * once associated-domains / intent-filters are configured.
 */
export const APP_WEB_BASE = 'https://caps.ftable.co.il';

export function buildInviteUrl(code: string): string {
  return `${APP_WEB_BASE}/invite/${code}`;
}
