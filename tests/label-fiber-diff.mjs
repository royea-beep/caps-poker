/**
 * MP HAND LABELS, THIRD ATTEMPT — BACKWARDS FROM THE PIXEL.
 *
 * Two sprints of walking payload -> render did not find this. So this does not trace forward at
 * all. It finds the DOM node that ACTUALLY RENDERED the comparison text, walks the React fiber up
 * from that node to the component that produced it, and reads the props that component was
 * ACTUALLY GIVEN. Then the same in a multiplayer hand, and diffs them.
 *
 * No code change is needed: react-native-web renders real DOM, and React attaches the fiber to the
 * node under a __reactFiber$… key, so the props are readable in the shipped bundle.
 *
 *   MODE=solo node tests/label-fiber-diff.mjs
 */
import { webkit } from 'playwright';
import { installFire, where } from './harness/play.mjs';

const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';

const PROBE = () => {
  const out = { found: false, chain: [], boardKeys: null, sample: null, note: '' };
  // 1. the pixel: the node whose own text contains " beats "
  const all = [...document.querySelectorAll('div,span')];
  const hit = all.filter((e) => / beats /.test(e.textContent || '') && e.children.length === 0);
  if (!hit.length) { out.note = 'no element renders " beats "'; return out; }
  const node = hit[0];
  out.found = true;
  out.text = (node.textContent || '').trim();

  // 2. the fiber attached to that exact node
  const key = Object.keys(node).find((k) => k.startsWith('__reactFiber$'));
  if (!key) { out.note = 'no __reactFiber$ key on the rendering node'; return out; }

  // 3. walk UP until a component whose props carry a `board`
  let f = node[key];
  let depth = 0;
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
  out.note = 'walked 40 fibers up and found no props.board';
  return out;
};

const b = await webkit.launch({ headless: false });
const ctx = await b.newContext({ viewport: { width: 393, height: 900 } });
const page = await ctx.newPage();
page.on('dialog', async (d) => { await d.dismiss(); });

await page.goto(`${SITE}/game?players=2&fresh=${Date.now() % 1000}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(11000);
await installFire(page);
await page.evaluate(`(()=>{const x=[...document.querySelectorAll('button,[role="button"]')]
  .find(e=>/auto-place all/i.test((e.getAttribute('aria-label')||'')+' '+(e.textContent||''))); if(x) window.__f(x);})()`);
await page.waitForTimeout(2600);
await installFire(page);
await page.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]'); if(r) window.__f(r);})()`);
for (let i = 0; i < 55; i++) {
  await page.waitForTimeout(1000);
  let w; try { w = await where(page); } catch { break; }
  if (w.path === '/results') break;
}
await page.waitForTimeout(7000);

const r = await page.evaluate(PROBE);
console.log('\n══ SOLO /results');
console.log(JSON.stringify(r, null, 2));
console.log(`   device: ${await page.evaluate(`localStorage.getItem('caps-device-id')`)}`);
await b.close();
