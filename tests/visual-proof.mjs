import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'https://caps.ftable.co.il';
const DIR = 'docs/visual-proof';
fs.mkdirSync(DIR, { recursive: true });

// real-user state: skip the first-run overlays (WebLandingHero needs ?play=1;
// InteractiveTutorial + OnboardingOverlay gate on these localStorage keys).
const SEED = `
  try {
    localStorage.setItem('has_seen_interactive_tutorial','true');
    localStorage.setItem('hasSeenOnboarding','true');
    localStorage.setItem('guidedModeForced','false');
  } catch(e){}
`;

const SCREENS = [
  ['Home', '/'],
  ['Play', '/play'],
  ['Game (placement)', '/game'],
  ['Friends', '/friends'],
  ['Leaderboard', '/leaderboard'],
  ['Cups', '/cups'],
  ['Profile', '/profile'],
  ['Settings', '/settings'],
  ['Shop', '/shop'],
  ['Chip Store', '/chip-store'],
  ['Achievements', '/achievements'],
  ['Hand History', '/hand-history'],
  ['Tournament', '/tournament'],
  ['Sit & Go', '/sit-and-go'],
  ['MP Host', '/lobby/host'],
  ['MP Join', '/lobby/join'],
  ['Rank', '/rank'],
  ['Missions', '/missions'],
];

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2, hasTouch: true });
await ctx.addInitScript(SEED);
const p = await ctx.newPage();

const results = [];
for (const [label, route] of SCREENS) {
  let errs = [];
  const onErr = (m) => { if (m.type && m.type() === 'error') errs.push(m.text().slice(0, 120)); };
  p.on('console', onErr);
  const file = `${label.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.png`;
  let status = 'PASS', note = '';
  try {
    const sep = route.includes('?') ? '&' : '?';
    await p.goto(`${BASE}${route}${sep}play=1`, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await p.waitForTimeout(route === '/game' ? 4500 : 2800);
    // dismiss any lingering overlay (case-insensitive Skip)
    const skip = p.getByText(/^skip$/i).first();
    if (await skip.count().catch(() => 0)) { await skip.click({ timeout: 2500, force: true }).catch(() => {}); await p.waitForTimeout(800); }
    const txt = (await p.evaluate(() => document.body?.innerText || '')).trim();
    const rendered = txt.length > 15;
    // detect a covering full-screen overlay still on top of the header
    const covered = await p.evaluate(() => {
      const el = document.elementFromPoint(195, 60);
      return el ? (el.textContent || '').includes('CAPS POKER') && (el.textContent || '').includes('Up to 4') : false;
    });
    if (!rendered) { status = 'FAIL'; note = 'blank'; }
    else if (covered) { status = 'WARN'; note = 'landing overlay still up'; }
    else if (errs.length) { status = 'WARN'; note = errs.length + ' console err'; }
    note = note || `${txt.slice(0, 40).replace(/\n/g, ' ')}`;
    await p.screenshot({ path: `${DIR}/${file}`, fullPage: true });
  } catch (e) { status = 'FAIL'; note = String(e).slice(0, 80); }
  p.off('console', onErr);
  results.push({ label, route, file, status, note, errs: errs.slice(0, 2) });
  console.log(`[${status}] ${label} (${route}) | ${note}`);
}

await b.close();
fs.writeFileSync(`${DIR}/results.json`, JSON.stringify(results, null, 2));
console.log('\nSCREENS:', results.length, '| PASS', results.filter(r => r.status === 'PASS').length,
  '| WARN', results.filter(r => r.status === 'WARN').length, '| FAIL', results.filter(r => r.status === 'FAIL').length);
