/**
 * S93 — Navigation Breadcrumbs
 * Tracks screen navigation history (last 20 entries).
 * Call addBreadcrumb(path) on every route change.
 * Call getBreadcrumbs() from BugReporter to include history in every report.
 */

interface Crumb {
  screen: string;
  ts: string;
}

const CRUMBS: Crumb[] = [];
const MAX = 20;

export function addBreadcrumb(screen: string): void {
  if (!screen) return;
  CRUMBS.push({ screen, ts: new Date().toISOString() });
  if (CRUMBS.length > MAX) CRUMBS.shift();
}

export function getBreadcrumbs(): Crumb[] {
  return [...CRUMBS];
}
