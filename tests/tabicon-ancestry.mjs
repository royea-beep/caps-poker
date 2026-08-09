/**
 * TAB ICON DOUBLE-RENDER — find WHO renders the second node, before changing anything.
 *
 * app/(tabs)/_layout.tsx's TabIcon returns exactly ONE <Text>. So the second node is not
 * authored in our code, and "delete the redundant render" has no target until we know where it
 * comes from. The fs20/fs18 pair maps exactly onto `focused ? 20 : 18`, so something renders
 * the icon twice with DIFFERENT focused values.
 *
 * This walks up from each duplicated emoji and prints the ancestor chain — tag, role, aria,
 * and the computed opacity/transform of each level. If react-navigation is cross-fading two
 * states, the two chains diverge at the level that owns the animation, and its opacity tells
 * us whether the inactive copy is meant to be invisible (a styling bug on our side) or is
 * genuinely painted twice.
 *
 *   node tests/tabicon-ancestry.mjs
 */
import { chromium } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const expr = `(() => {
  const EMOJI = ['🏠', '♠️', '👥', '🏆', '👤'];
  const leaf = [...document.querySelectorAll('*')].filter((e) => !e.children.length);
  const out = [];
  for (const em of EMOJI) {
    const hits = leaf.filter((e) => (e.textContent || '').trim() === em);
    if (hits.length < 2) { out.push({ emoji: em, count: hits.length, chains: [] }); continue; }
    const chains = hits.map((e) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      const chain = [];
      let n = e.parentElement, d = 0;
      while (n && d < 5) {
        const ncs = getComputedStyle(n);
        chain.push({
          tag: n.tagName.toLowerCase(),
          role: n.getAttribute('role') || n.getAttribute('aria-selected') || '',
          op: ncs.opacity,
          disp: ncs.display,
          vis: ncs.visibility,
          cls: (n.className || '').toString().slice(0, 38),
        });
        n = n.parentElement; d++;
      }
      return { fs: cs.fontSize, op: cs.opacity, vis: cs.visibility,
               box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
               chain };
    });
    out.push({ emoji: em, count: hits.length, chains });
  }
  return out;
})()`;

const browser = await chromium.launch({ headless: false, args: ['--window-size=410,900'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 812 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(11000);

let data;
try { data = await measure(page, expr, { label: 'tabicons' }); }
catch (e) { console.error('HARNESS:', e instanceof HarnessError ? e.message : String(e)); await browser.close(); process.exit(2); }
await browser.close();

if (!Array.isArray(data) || !data.length) { console.error('NOTHING MEASURED — failed measurement, not a negative.'); process.exit(2); }

for (const d of data) {
  console.log(`\n=== ${d.emoji}  nodes=${d.count} ===`);
  if (!d.chains.length) { console.log('  not duplicated at this sample'); continue; }
  d.chains.forEach((c, i) => {
    console.log(`  [${i}] fontSize=${c.fs} opacity=${c.op} vis=${c.vis} box=${c.box.join(',')}`);
    c.chain.forEach((a, j) => console.log(`        ^${j} <${a.tag}> op=${a.op} disp=${a.disp} vis=${a.vis} role=${a.role} cls=${a.cls}`));
  });
}
