/**
 * The same BACKWARDS-FROM-THE-PIXEL probe as label-fiber-diff.mjs, but on a real two-client
 * multiplayer hand. Reaches /results on client A and reads the props BoardResultCard was actually
 * given, so solo and MP can be diffed at the identical point.
 */
import { chromium } from 'playwright';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const W = 375, H = 812;
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const fire = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

const joinByCode = (code) => `(() => {
  const btns = [...document.querySelectorAll('button,[role="button"]')];
  const join = btns.find(b => {
    if (!/join/i.test((b.textContent || '') + (b.getAttribute('aria-label') || ''))) return false;
    let n = b, depth = 0;
    while (n && depth < 6) { if ((n.textContent || '').includes(${JSON.stringify(code)})) return true; n = n.parentElement; depth++; }
    return false;
  });
  if (join) { window.__f(join); return true; }
  return false;
})()`;

const PROBE = () => {
  const out = { found: false, chain: [], boardKeys: null, sample: null, note: '' };
  const hit = [...document.querySelectorAll('div,span')]
    .filter((e) => / beats /.test(e.textContent || '') && e.children.length === 0);
  if (!hit.length) { out.note = 'no element renders " beats "'; return out; }
  const node = hit[0];
  out.found = true;
  out.text = (node.textContent || '').trim();
  const key = Object.keys(node).find((k) => k.startsWith('__reactFiber$'));
  if (!key) { out.note = 'no __reactFiber$ key'; return out; }
  let f = node[key], depth = 0;
  while (f && depth < 40) {
    const name = typeof f.type === 'function' ? (f.type.name || f.type.displayName || 'anon')
               : typeof f.type === 'string' ? f.type : (f.type?.displayName || '');
    if (name) out.chain.push(name);
    const p = f.memoizedProps;
    if (p && p.board && typeof p.board === 'object') {
      out.componentWithBoard = name;
      out.boardKeys = Object.keys(p.board).sort();
      out.sample = {
        playerHandName: p.board.playerHandName,
        botHandName: p.board.botHandName,
        winner: p.board.winner,
        playerBestCards_isArray: Array.isArray(p.board.playerBestCards),
        playerBestCards_len: Array.isArray(p.board.playerBestCards) ? p.board.playerBestCards.length : null,
        botBestCards_isArray: Array.isArray(p.board.botBestCards),
        botBestCards_len: Array.isArray(p.board.botBestCards) ? p.board.botBestCards.length : null,
        playerBestCards_first: Array.isArray(p.board.playerBestCards) && p.board.playerBestCards[0]
          ? JSON.stringify(p.board.playerBestCards[0]) : null,
      };
      return out;
    }
    f = f.return; depth++;
  }
  out.note = 'walked 40 fibers up, no props.board';
  return out;
};

const place = async (p) => {
  await p.evaluate(`window.__f=${fire}`);
  await p.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/auto-place all/i.test(x.getAttribute('aria-label')||x.textContent||''));if(b)window.__f(b);})()`);
  await p.waitForTimeout(2000);
  await p.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]');if(r){window.__f(r);return true}
    const b=[...document.querySelectorAll('button,[role="button"]')].find(x=>/^\s*(ready|confirm)\b/i.test((x.getAttribute('aria-label')||x.textContent||'').trim()));
    if(b)window.__f(b);})()`);
};

const browser = await chromium.launch({ headless: false, args: [`--window-size=${W + 20},${H + 140}`] });
const mk = async () => {
  const c = await browser.newContext({ viewport: { width: W, height: H }, ignoreHTTPSErrors: true });
  await c.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
  const p = await c.newPage();
  p.on('dialog', async (d) => { await d.dismiss(); });
  return p;
};
const A = await mk(), B = await mk();
for (const p of [A, B]) {
  await p.goto(URL + '/lobby', { waitUntil: 'load', timeout: 120000 });
  await p.waitForTimeout(9000);
  await p.evaluate(`window.__f=${fire}`);
}
const codes = await A.evaluate(`(() => [...new Set((document.body.innerText || '').match(/#[A-Z0-9]{4}/g) || [])])()`);
const roomCode = (codes[0] || '').replace('#', '');
console.log(`joining ${roomCode}`);
await A.evaluate(joinByCode(roomCode)); await A.waitForTimeout(6000);
await B.evaluate(joinByCode(roomCode)); await B.waitForTimeout(14000);
await place(A); await B.waitForTimeout(1500); await place(B);

const tapReveal = async (p) => p.evaluate(`(() => {
  const els = [...document.querySelectorAll('*')].filter(e => /tap to reveal/i.test((e.textContent || '').trim()) && e.children.length < 3);
  const el = els[els.length - 1];
  if (!el) return false;
  window.__f(el.closest('[role="button"],button') || el);
  return true;
})()`).catch(() => false);

for (let i = 0; i < 90; i++) {
  await B.waitForTimeout(2000);
  if (/results/.test(A.url()) && /results/.test(B.url())) break;
  await tapReveal(A); await tapReveal(B);
}
await A.waitForTimeout(7000);
console.log('\n══ MP /results (client A)');
console.log(JSON.stringify(await A.evaluate(PROBE), null, 2));
console.log(`   A device: ${await A.evaluate(`localStorage.getItem('caps-device-id')`)}`);
console.log(`   B device: ${await B.evaluate(`localStorage.getItem('caps-device-id')`)}`);
console.log(`   room: ${roomCode}`);
await browser.close();
