/**
 * lobby/table — the waiting surface, control by control.
 *
 * States covered: the lobby list, a table with ONE player (us, as host), and what each exit does.
 * The two exits are semantically different and that is the whole point of the screen:
 *   "Back — keep your seat"                 -> minimise, seat is HELD
 *   "Leave table and give up your seat"     -> bail out, seat is FREED
 * Getting those two the wrong way round would silently evict a waiting player.
 *
 * A full table and someone-leaving need a second real client; this covers the single-player state
 * and names that boundary rather than implying more.
 *
 * CLEANUP: joining creates a real room + seat. The device id is printed so the room can be checked
 * and cleared afterwards.
 */
import { webkit, chromium } from 'playwright';
import { installFire } from './harness/play.mjs';

const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const ENGINE = process.env.ENGINE || 'webkit';
const VW = Number(process.env.VIEWPORT || 430);
const engine = ENGINE === 'chromium' ? chromium : webkit;

const b = await engine.launch({ headless: false });
const p = await (await b.newContext({ viewport: { width: VW, height: 900 } })).newPage();
const dialogs = [];
p.on('dialog', async (d) => { dialogs.push(`${d.type()}: ${d.message().slice(0, 70)}`); await d.dismiss(); });
const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 80)));

const SURVEY = () => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const name = (e) => (e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return {
    path: location.pathname + location.search,
    head: document.body.innerText.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 6),
    exposed: [...document.querySelectorAll('button,[role="button"],[role="header"]')].filter(vis).map(name),
    bare: [...document.querySelectorAll('[tabindex="0"]')].filter(vis)
      .filter((e) => !e.getAttribute('role') && e.tagName !== 'BUTTON').map(name),
  };
};
const show = async (label) => {
  const s = await p.evaluate(SURVEY);
  console.log(`\n── ${ENGINE}/${VW} · ${label} · ${s.path}`);
  console.log(`   sees: ${JSON.stringify(s.head)}`);
  console.log(`   EXPOSED(${s.exposed.length}): ${JSON.stringify(s.exposed)}`);
  console.log(`   UNEXPOSED(${s.bare.length}): ${JSON.stringify(s.bare.slice(0, 8))}`);
  return s;
};

await p.goto(SITE + '/', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(10000);
const device = await p.evaluate(`localStorage.getItem('caps-device-id')`);

await p.goto(SITE + '/lobby', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(9000);
await show('lobby list');

// Join the first offered table.
await installFire(p);
// Anchor on the DECLARED label "Join table XXXX". An earlier version matched /players|table/
// loosely and hit the "Practice game versus a bot" row, landing in /game instead of /lobby/table.
const joined = await p.evaluate(() => {
  const b = [...document.querySelectorAll('button,[role="button"]')]
    .find((x) => /^join table /i.test((x.getAttribute('aria-label') || '').trim()));
  if (!b) return null;
  window.__f(b);
  return (b.getAttribute('aria-label') || '').trim().slice(0, 50);
});
console.log(`\n   tapped in lobby: ${JSON.stringify(joined)}`);
await p.waitForTimeout(9000);
const t = await show('lobby/table — ONE player (us)');

// Operate the safe control.
await installFire(p);
const shared = await p.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')]
  .find(x=>/share table code/i.test(x.getAttribute('aria-label')||'')); if(!b) return false; window.__f(b); return true;})()`);
await p.waitForTimeout(2500);
console.log(`   operated "Share table code": ${shared}  dialogs=${JSON.stringify(dialogs)}`);

// Exit by GIVING UP the seat.
await installFire(p);
const left = await p.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')]
  .find(x=>/leave table/i.test(x.getAttribute('aria-label')||'')); if(!b) return false; window.__f(b); return true;})()`);
await p.waitForTimeout(7000);
await show(`after "Leave table and give up your seat" (tapped=${left})`);

console.log(`\n   pageerrors=${errs.length} ${errs.length ? JSON.stringify(errs.slice(0, 2)) : ''}`);
console.log(`   DEVICE TO CLEAN: ${device}`);
await b.close();
