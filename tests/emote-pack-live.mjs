/**
 * EMOTES — the fifth criterion. The chat strip is multiplayer-only, so this drives TWO REAL CLIENTS
 * into one live room and reads the six emoji off client A's strip. Two automated clients in a real
 * room are two real clients; nothing here is simulated.
 *
 * Shape lifted from tests/mp-full-hand.mjs (join-by-code from the lobby) and the shared
 * tests/harness/play.mjs primitives.
 *
 *   node tests/emote-pack-live.mjs
 */
import { chromium } from 'playwright';
import { installFire } from './harness/play.mjs';

const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';  // NOT `URL` — that shadows the global constructor
const W = Number(process.env.VIEWPORT || 430), H = 900;
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const CLASSIC = ['😂', '💀', '🔥', '👏', '😤', '🤝'];
const WILD    = ['🤯', '🫠', '🚀', '🧊', '🤝', '🐐'];

/**
 * Read the emoji actually rendered on the chat strip.
 * Anchored on the per-button accessibility label ChatOverlay.tsx:84 already emits
 * (`Send {emote} emote`). The first version scanned for pictographic glyphs by size and picked up
 * the CARD SUITS instead — ♠♥♣♦ match \p{Extended_Pictographic} too. Anchor on the label, never on
 * "things that look like emoji".
 */
const STRIP = `(() => {
  const btns = [...document.querySelectorAll('[aria-label]')]
    .filter(e => /^Send .+ emote$/.test(e.getAttribute('aria-label') || ''));
  return { strip: btns.map(e => e.getAttribute('aria-label').replace(/^Send /, '').replace(/ emote$/, '')),
           buttons: btns.length,
           hasChatBar: !!btns.length };
})()`;

const devices = [];
const browser = await chromium.launch({ headless: false });
const mk = async () => {
  const c = await browser.newContext({ viewport: { width: W, height: H }, ignoreHTTPSErrors: true });
  await c.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
  const p = await c.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 90)));
  return { p, errs };
};

try {
  const A = await mk(), B = await mk();

  // ── A buys the pack through the real shop, then selects WILD in the real picker
  await A.p.goto(SITE + '/shop', { waitUntil: 'domcontentloaded' }); await A.p.waitForTimeout(12000);
  await installFire(A.p);
  const bought = await A.p.evaluate(`(()=>{const label=[...document.querySelectorAll('div')]
      .find(e=>e.children.length===0 && e.textContent.trim()==='Emote pack');
    if(!label) return 'no-item';
    let card=label;
    for(let i=0;i<6&&card;i++){const b=[...card.querySelectorAll('div')]
        .find(e=>e.children.length===0 && e.textContent.trim()==='Buy');
      if(b){window.__f(b);return 'clicked'} card=card.parentElement;}
    return 'no-buy';})()`);
  await A.p.waitForTimeout(4000);
  console.log('A buy emote pack ->', bought);

  await A.p.goto(SITE + '/settings', { waitUntil: 'domcontentloaded' }); await A.p.waitForTimeout(14000);
  await installFire(A.p);
  const picked = await A.p.evaluate(`(()=>{const t=document.querySelector('[data-testid="emote-pack-wild"]');
    if(!t) return 'no-tile'; window.__f(t); return 'picked';})()`);
  await A.p.waitForTimeout(2000);
  const pack = await A.p.evaluate(`(()=>{try{return JSON.parse(localStorage.getItem('caps-poker-storage')).state.emotePack}catch{return '?'}})()`);
  console.log('A select WILD ->', picked, '| persisted emotePack =', pack);

  // ── both into the lobby, join the same room
  for (const cl of [A, B]) {
    await cl.p.goto(SITE + '/lobby', { waitUntil: 'domcontentloaded' });
    await cl.p.waitForTimeout(10000);
    await installFire(cl.p);
    devices.push(await cl.p.evaluate(`localStorage.getItem('caps-device-id')`));
  }
  const codes = await A.p.evaluate(`[...new Set((document.body.innerText||'').match(/#[A-Z0-9]{4}/g)||[])]`);
  console.log('room codes visible:', JSON.stringify(codes));
  if (!codes.length) { console.log('NO ROOM AVAILABLE — cannot reach a live strip this run'); }
  else {
    const code = codes[0].replace('#', '');
    const joinByCode = (c) => `(() => { const btns=[...document.querySelectorAll('button,[role="button"]')];
      const j=btns.find(b=>{ if(!/join/i.test((b.textContent||'')+(b.getAttribute('aria-label')||''))) return false;
        let n=b,d=0; while(n&&d<6){ if((n.textContent||'').includes(${JSON.stringify('#' + c)})) return true; n=n.parentElement; d++; } return false; });
      if(j){window.__f(j);return true} return false; })()`;
    console.log('A join ->', await A.p.evaluate(joinByCode(code))); await A.p.waitForTimeout(6000);
    console.log('B join ->', await B.p.evaluate(joinByCode(code))); await B.p.waitForTimeout(14000);
    console.log('A url:', new URL(A.p.url()).pathname, '| B url:', new URL(B.p.url()).pathname);

    const s = await A.p.evaluate(STRIP);
    console.log('A strip emoji:', JSON.stringify(s.strip));
    const isWild = WILD.every((e) => s.strip.includes(e));
    const isClassic = CLASSIC.every((e) => s.strip.includes(e));
    console.log(`STRIP IS WILD: ${isWild} | STRIP IS CLASSIC: ${isClassic}`);
    await A.p.screenshot({ path: 'tests/screenshots/emote-strip-wild.png' });
  }
  console.log('DEVICES=' + devices.join(','));
} finally {
  await browser.close();
}
