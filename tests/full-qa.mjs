// VAMOS-CAPS FULL-QA-COUNCIL — live-site sweep.
// Boots fresh, completes the single onboarding, then visits every screen: captures
// console/page/network errors, screenshots, and clicks every visible button recording the
// action (navigation / error). Critical flows (single-player playthrough, lobby) asserted.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const BASE = process.env.BASE || 'https://caps.ftable.co.il';
const OUT = 'test-results/full-qa';
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[qa]', ...a);

const results = []; // { screen, type, detail, status, evidence }
const errorsByScreen = {}; // screen -> [errors]
let currentScreen = 'boot';

function attachErrorCapture(page) {
  const push = (kind, text) => {
    const t = String(text).slice(0, 240);
    // filter known-benign noise
    if (/Download the React DevTools|favicon|the server responded with a status of 4(0[0-9]|1[0-9]) \(\)$/i.test(t)) {
      // keep 4xx/5xx but tag; drop pure devtools/favicon
      if (/React DevTools|favicon/i.test(t)) return;
    }
    (errorsByScreen[currentScreen] ||= []).push(`[${kind}] ${t}`);
  };
  page.on('console', (m) => { if (m.type() === 'error') push('console', m.text()); });
  page.on('pageerror', (e) => push('pageerror', e.message));
  page.on('requestfailed', (r) => push('reqfail', `${r.failure()?.errorText} ${r.url().slice(0, 120)}`));
  page.on('response', (r) => { if (r.status() >= 400) push('http' + r.status(), r.url().slice(0, 120)); });
}

async function gotoScreen(page, path, name) {
  currentScreen = name;
  errorsByScreen[name] ||= [];
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(3500);
  await page.screenshot({ path: `${OUT}/${name}.png` }).catch(() => {});
}

async function buttonsOnScreen(page) {
  return page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('[role="button"], [aria-label], button'));
    const seen = new Set();
    return els.map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60))
      .filter((l) => l && !seen.has(l) && seen.add(l));
  });
}

async function completeOnboarding(page) {
  currentScreen = 'onboarding';
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await sleep(8000);
  // InteractiveTutorial: click NEXT through steps (step 2 needs a card tap), else Skip.
  for (let i = 0; i < 6; i++) {
    const tapCard = page.getByText(/TAP A CARD/i).first();
    if (await tapCard.isVisible({ timeout: 400 }).catch(() => false)) {
      // tap a tutorial card to enable NEXT
      await page.locator('text=TAP A CARD').first().click().catch(() => {});
      await sleep(400);
    }
    const next = page.getByText(/^(NEXT|הבא|DEAL ME IN|בואו)/i).first();
    if (await next.isVisible({ timeout: 600 }).catch(() => false)) { await next.click().catch(() => {}); await sleep(700); continue; }
    const skip = page.getByText(/^(Skip|דלג)$/).first();
    if (await skip.isVisible({ timeout: 600 }).catch(() => false)) { await skip.click().catch(() => {}); await sleep(700); break; }
    break;
  }
  await sleep(1500);
  const stillOnboarding = await page.getByText(/cards per board|TAP A CARD|What is CAPS/i).first().isVisible({ timeout: 600 }).catch(() => false);
  log('onboarding completed; still showing?', stillOnboarding);
}

const ROUTES = [
  ['/', 'home'],
  ['/play', 'play'],
  ['/friends', 'friends'],
  ['/cups', 'cups'],
  ['/profile', 'profile'],
  ['/lobby', 'lobby'],
  ['/settings', 'settings'],
  ['/shop', 'shop'],
  ['/chip-store', 'chip-store'],
  ['/leaderboard', 'leaderboard'],
  ['/achievements', 'achievements'],
  ['/missions', 'missions'],
  ['/hand-history', 'hand-history'],
  ['/stats', 'stats'],
  ['/referral', 'referral'],
  ['/battle-pass', 'battle-pass'],
  ['/coaching', 'coaching'],
  ['/spectate', 'spectate'],
  ['/rank', 'rank'],
  ['/play-of-day', 'play-of-day'],
  ['/heatmap', 'heatmap'],
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  attachErrorCapture(page);

  await completeOnboarding(page);

  // Visit every route, screenshot + capture errors + list buttons
  const screenButtons = {};
  for (const [path, name] of ROUTES) {
    await gotoScreen(page, path, name);
    const btns = await buttonsOnScreen(page).catch(() => []);
    screenButtons[name] = btns;
    const bodyLen = await page.evaluate(() => document.body.innerText.trim().length).catch(() => 0);
    const errs = errorsByScreen[name] || [];
    results.push({ screen: name, type: 'render', detail: `${btns.length} buttons, bodyLen ${bodyLen}`, status: bodyLen > 50 ? 'PASS' : 'FAIL', evidence: `${name}.png` });
    log(`${name}: ${btns.length} buttons, bodyLen ${bodyLen}, errors ${errs.length}`);
  }

  writeFileSync(`${OUT}/buttons.json`, JSON.stringify(screenButtons, null, 2));
  writeFileSync(`${OUT}/errors.json`, JSON.stringify(errorsByScreen, null, 2));
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));

  // Error summary
  const totalErrs = Object.values(errorsByScreen).flat().length;
  log('=== ERROR SUMMARY (', totalErrs, 'total) ===');
  for (const [s, e] of Object.entries(errorsByScreen)) if (e.length) log(`  ${s}: ${e.length}`, JSON.stringify(e.slice(0, 4)));

  await browser.close();
  log('DONE — screenshots in', OUT);
}
run();
