/**
 * FRONT DOOR — are the first controls a player meets exposed to assistive tech?
 *
 * Measures the three surfaces the panel blocked on:
 *   1. the first-run tutorial overlay (SKIP ✕ / Continue / 3 progress dots)
 *   2. the side menu (ten entries)
 *   3. /theme-pick (two tiles)
 * and whether Tab can escape the overlay to reach the app behind it.
 *
 * Anchored on what the PAGE EXPOSES as a button (role/tag), never on text or geometry — the whole
 * defect is that these render fine and expose nothing.
 *
 *   ENGINE=webkit node tests/front-door-a11y.mjs
 */
import { webkit, chromium } from 'playwright';
import { installFire } from './harness/play.mjs';

const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const ENGINE = process.env.ENGINE || 'webkit';
const VW = Number(process.env.VIEWPORT || 430);
const engine = ENGINE === 'chromium' ? chromium : webkit;
const tag = `${ENGINE}/${VW}`;

const browser = await engine.launch({ headless: false });
const page = await (await browser.newContext({ viewport: { width: VW, height: 900 } })).newPage();
page.on('dialog', async (d) => { await d.dismiss(); });
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 100)));

/** Everything the page exposes as an operable control, and everything focusable that is NOT. */
const survey = () => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const exposed = [...document.querySelectorAll('button,[role="button"],[role="tab"],[role="link"]')]
    .filter(vis).map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30));
  const bare = [...document.querySelectorAll('[tabindex="0"]')]
    .filter(vis).filter((e) => !e.getAttribute('role') && e.tagName !== 'BUTTON')
    .map((e) => (e.textContent || '').trim().slice(0, 30));
  return { path: location.pathname, exposed, bare, exposedN: exposed.length, bareN: bare.length };
};

const show = (label, s) => {
  console.log(`\n── ${tag} · ${label} · ${s.path}`);
  console.log(`   EXPOSED (${s.exposedN}): ${JSON.stringify(s.exposed.slice(0, 14))}`);
  console.log(`   UNEXPOSED tabindex=0, no role (${s.bareN}): ${JSON.stringify(s.bare.slice(0, 14))}`);
  return s;
};

// 1 — first-run overlay
await page.goto(SITE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(11000);
const overlay = show('first-run overlay', await page.evaluate(survey));

// 1b — can the REAL Tab key escape the overlay and reach the app behind it?
// Synthetic .focus() cycling proves nothing about Tab order; this presses the actual key.
const overlayBox = await page.evaluate(() => {
  // The overlay is the SMALLEST element containing BOTH its controls. A "tall div containing
  // SKIP" also contains the whole app, which is how an earlier version of this probe reported
  // escaped=false while focus was demonstrably landing on the side menu.
  const cands = [...document.querySelectorAll('div')].filter((d) => {
    const t = d.textContent || '';
    return /SKIP/.test(t) && /Continue|Let/.test(t);
  });
  const card = cands.sort((a, b) => {
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    return (ra.width * ra.height) - (rb.width * rb.height);
  })[0];
  if (card) card.setAttribute('data-a11y-probe-overlay', '1');
  return !!card;
});
await page.evaluate(() => (document.activeElement)?.blur?.());
const walk = [];
let escaped = false;
for (let i = 0; i < 16; i++) {
  await page.keyboard.press('Tab');
  const at = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { name: '(body)', inside: true };
    const ov = document.querySelector('[data-a11y-probe-overlay]');
    return {
      name: (el.getAttribute('aria-label') || el.textContent || el.tagName || '?').trim().slice(0, 26),
      inside: !ov ? true : ov.contains(el),
    };
  });
  walk.push(at.name);
  // Semantic escape test. DOM-containment heuristics kept misreporting this (a "div containing
  // SKIP" can be the app root), so escape is judged by WHAT focus landed on: any of these is a
  // control behind the tutorial, and reaching it means Tab left the overlay.
  if (/PLAY ONLINE|BATTLE PASS|STATS|HAND HISTORY|COACHING|SETTINGS|TUTORIAL|SIGN IN|LANGUAGE|Open menu|Open chip shop|Report a bug|referral|^Play$|^Home$|^Friends$|^Cups$|^Profile$/i.test(at.name)) {
    escaped = true;
  }
}
const trap = { seen: walk.slice(0, 8), escaped, overlayFound: overlayBox };
console.log(`   REAL TAB WALK   : overlayFound=${trap.overlayFound} escapedOverlay=${trap.escaped}`);
console.log(`   focus landed on : ${JSON.stringify(trap.seen)}`);

// 2 — side menu
await installFire(page);
const opened = await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"],[tabindex="0"]')]
  .find(x=>/open menu/i.test((x.getAttribute('aria-label')||'')+' '+(x.textContent||'')));
  if(!b) return false; window.__f(b); return true;})()`);
await page.waitForTimeout(2500);
const menu = show(`side menu (opened=${opened})`, await page.evaluate(survey));

// 3 — theme-pick
await page.goto(SITE + '/theme-pick', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
const theme = show('theme-pick', await page.evaluate(survey));

console.log(`\n══ ${tag} SUMMARY`);
console.log(`   overlay   exposed=${overlay.exposedN} unexposed=${overlay.bareN}`);
console.log(`   side menu exposed=${menu.exposedN} unexposed=${menu.bareN}`);
console.log(`   theme-pick exposed=${theme.exposedN} unexposed=${theme.bareN}`);
console.log(`   focus escaped overlay: ${trap.escaped}`);
console.log(`   pageerrors: ${errs.length}`);
console.log(`   DEVICE: ${await page.evaluate(`localStorage.getItem('caps-device-id')`)}`);
await browser.close();
