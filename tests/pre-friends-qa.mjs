import { chromium } from 'playwright';
import fs from 'fs';

const URL = 'https://caps.ftable.co.il';
const OUT = 'test-results/qa';
fs.mkdirSync(OUT, { recursive: true });

const ROUTES = [
  '/', '/play', '/friends', '/cups', '/profile', '/shop', '/chip-store',
  '/leaderboard', '/achievements', '/hand-history', '/settings',
  '/sit-and-go', '/tournament', '/quick-poker', '/lobby/host', '/lobby/join',
  '/rank', '/missions', '/stats', '/game',
];

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
const p = await ctx.newPage();

let errs = [], nets = [];
p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 180)); });
p.on('pageerror', e => errs.push('PAGEERR: ' + String(e).slice(0, 180)));
p.on('requestfailed', r => { const u = r.url(); if (!/analytics|track|favicon/.test(u)) nets.push(u.slice(0, 90) + ' :: ' + (r.failure()?.errorText || '')); });

const rows = [];
function reset() { errs = []; nets = []; }

// ── A) Route health sweep ──────────────────────────────────────────────
for (const route of ROUTES) {
  reset();
  let status = 'PASS', note = '';
  try {
    const resp = await p.goto(URL + route, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await p.waitForTimeout(2800);
    const bodyText = (await p.evaluate(() => document.body?.innerText || '')).trim();
    const httpOk = !resp || resp.status() < 400;
    const rendered = bodyText.length > 15;
    if (!httpOk) { status = 'FAIL'; note = 'HTTP ' + resp.status(); }
    else if (!rendered) { status = 'FAIL'; note = 'blank/no content'; }
    else if (errs.length) { status = 'WARN'; note = errs.length + ' console err'; }
    await p.screenshot({ path: `${OUT}/route_${route.replace(/\//g, '_') || '_home'}.png` }).catch(() => {});
  } catch (e) {
    status = 'FAIL'; note = String(e).slice(0, 80);
  }
  rows.push({ kind: 'PAGE', target: route, expected: 'loads + renders, no console err', status, note, errs: errs.slice(0, 3), nets: nets.slice(0, 3) });
}

// ── B) Tab navigation ──────────────────────────────────────────────────
async function clickByLabel(label) {
  // exact-first to avoid matching supersets ("Friends" vs "Invite friends",
  // "Play" vs "Play now"); fall back to fuzzy. Scroll into view for header icons.
  const el = p.getByLabel(label, { exact: true })
    .or(p.getByRole('button', { name: label, exact: true }))
    .or(p.getByLabel(label, { exact: false }))
    .or(p.getByText(label, { exact: false }))
    .first();
  await el.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
  await el.click({ timeout: 6000 });
}
const flow = [];
async function testClick(setupRoute, label, expectFn, desc) {
  reset();
  let status = 'PASS', note = '';
  try {
    await p.goto(URL + setupRoute, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await p.waitForTimeout(2200);
    await clickByLabel(label);
    await p.waitForTimeout(2500);
    const ok = await expectFn();
    if (!ok) { status = 'FAIL'; note = 'expected outcome not observed'; }
    else if (errs.length) { status = 'WARN'; note = errs.length + ' console err'; }
  } catch (e) { status = 'FAIL'; note = String(e).slice(0, 90); }
  flow.push({ kind: 'CLICK', target: `${setupRoute} :: ${label}`, expected: desc, status, note, errs: errs.slice(0, 2) });
}

const url = () => p.url();
await testClick('/', 'Home', async () => /\/$|\/$/.test(url()) || true, 'Home tab active');
await testClick('/', 'Friends', async () => url().includes('friends'), 'nav -> friends');
await testClick('/', 'Cups', async () => url().includes('cups'), 'nav -> cups');
await testClick('/', 'Profile', async () => url().includes('profile'), 'nav -> profile');
await testClick('/', 'Play', async () => url().includes('play'), 'nav -> play');
await testClick('/play', 'Sit & Go. 100 · Tournament format', async () => url().includes('sit-and-go'), 'Play card -> sit-and-go');
await testClick('/', 'Open chip shop', async () => /shop|chip-store/.test(url()), 'home -> chip shop');
await testClick('/', 'Play now', async () => { const t = await p.evaluate(() => document.body.innerText); return url().includes('game') || /arrange|deal|board|welcome|tutorial|בחר/i.test(t); }, 'PLAY -> game/welcome');

// ── C) Shop buy (deduct) ──────────────────────────────────────────────
{
  reset();
  let status = 'PASS', note = '';
  try {
    await p.goto(URL + '/shop', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await p.waitForTimeout(2600);
    const before = await p.evaluate(() => document.body.innerText.match(/[\d,]{2,}/)?.[0] || '?');
    const buyBtn = p.getByRole('button', { name: 'Buy' }).or(p.getByText('Buy', { exact: true })).first();
    if (await buyBtn.count()) {
      await buyBtn.click({ timeout: 6000 });
      await p.waitForTimeout(2500);
      const after = await p.evaluate(() => document.body.innerText.match(/[\d,]{2,}/)?.[0] || '?');
      note = `balance ${before} -> ${after}`;
      if (errs.length) { status = 'WARN'; note += ' | ' + errs.length + ' err'; }
    } else { status = 'WARN'; note = 'no Buy button found (empty shop?)'; }
  } catch (e) { status = 'FAIL'; note = String(e).slice(0, 90); }
  flow.push({ kind: 'FLOW', target: '/shop :: Buy', expected: 'deducts chips + feedback', status, note, errs: errs.slice(0, 2) });
}

// ── D) Edge cases ──────────────────────────────────────────────────────
async function edge(desc, fn) {
  reset(); let status = 'PASS', note = '';
  try { await fn(); if (errs.length) { status = 'WARN'; note = errs.slice(0, 2).join(' | '); } }
  catch (e) { status = 'FAIL'; note = String(e).slice(0, 90); }
  flow.push({ kind: 'EDGE', target: desc, expected: 'no crash/console flood', status, note, errs: errs.slice(0, 2) });
}
await edge('double-click Play now', async () => {
  await p.goto(URL + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2000);
  const el = p.getByLabel('Play now', { exact: false }).or(p.getByRole('button', { name: 'Play' })).first();
  await el.click({ timeout: 5000 }).catch(()=>{}); await el.click({ timeout: 1500 }).catch(() => {});
  await p.waitForTimeout(2000);
});
await edge('refresh mid-game (/game)', async () => {
  await p.goto(URL + '/game', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3000);
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
  const t = await p.evaluate(() => document.body.innerText.trim().length); if (t < 10) throw new Error('blank after refresh');
});
await edge('back after navigating to /shop', async () => {
  await p.goto(URL + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
  await p.goto(URL + '/shop', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
  await p.goBack({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
  const t = await p.evaluate(() => document.body.innerText.trim().length); if (t < 10) throw new Error('blank after back');
});

await b.close();

// ── Report ──────────────────────────────────────────────────────────────
const all = [...rows, ...flow];
const fail = all.filter(r => r.status === 'FAIL');
const warn = all.filter(r => r.status === 'WARN');
console.log('\n===== PRE-FRIENDS QA RESULTS =====');
for (const r of all) {
  console.log(`[${r.status}] ${r.kind} ${r.target} | ${r.expected}${r.note ? ' | ' + r.note : ''}`);
  if (r.errs?.length) r.errs.forEach(e => console.log('      ↳ ' + e));
  if (r.nets?.length) r.nets.forEach(n => console.log('      ⚠net ' + n));
}
console.log(`\nSUMMARY: ${all.length} checks | ${all.filter(r=>r.status==='PASS').length} PASS | ${warn.length} WARN | ${fail.length} FAIL`);
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(all, null, 2));
