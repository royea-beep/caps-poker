/**
 * FILE A REPORT THROUGH THE BUILT APP AND READ THE ROW BACK.
 *
 * REPORTER-AND-BOARD4 §1.5 — "confirm what actually arrives; read the row, do not trust the 200."
 *
 * ⚠️ WHAT THIS CAN AND CANNOT REACH, stated rather than implied. There are TWO writers into
 * bug_reports from the client:
 *   components/ReportBugButton.tsx  the Settings entry. Text only, and it has always correctly
 *                                   said report_type 'text'. THIS is what this rig drives, because
 *                                   it is the only one reachable from a browser.
 *   components/BugReporter.tsx      the shake/FAB recorder — the media path, and the one this
 *                                   sprint changed. handleStart returns early when
 *                                   Platform.OS === 'web' (BugReporter.tsx:472) and the capture
 *                                   API is native-only, so NO browser can start it. Its row shape
 *                                   is covered by utils/__tests__/attachment-note.test.ts and by
 *                                   tsc; the live proof needs a device.
 *
 * Run against a local static build, backend NOT aborted (this one must really reach Supabase).
 */
import { chromium } from 'playwright';

const URL = process.env.CAPS_URL || 'http://127.0.0.1:8899';
const STAMP = process.env.STAMP || `REPORTER-AND-BOARD4 E2E ${Date.now()}`;
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const ctx = await b.newContext({ viewport: { width: 393, height: 852 } });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, SEED);
const p = await ctx.newPage();
p.on('console', (m) => { const t = m.text(); if (/BUG|report|error/i.test(t)) console.log('  console:', t.slice(0, 120)); });

await p.goto(`${URL}/settings/`, { waitUntil: 'load', timeout: 60000 });
await p.waitForTimeout(7000);

const row = p.locator('text=/Report a bug|דווח על תקלה/i').first();
await row.waitFor({ timeout: 15000 });
await row.click();
await p.waitForTimeout(1500);

const box = p.locator('textarea, input[type="text"]').first();
await box.waitFor({ timeout: 10000 });
await box.fill(STAMP + ' — pipeline check, not a player report. Reporter row shape after the frames change.');
await p.waitForTimeout(400);

const send = p.locator('text=/^(SEND|שלח)/i').first();
await send.click();
await p.waitForTimeout(6000);
await p.screenshot({ path: 'docs/reporter-and-board4/e2e-sent.png' });
console.log('submitted with stamp:', STAMP);
await b.close();
