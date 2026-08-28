/**
 * FIND THE NEXT "REMATC / H" — WITHOUT A DEVICE.
 *
 * Native cannot be driven in this environment (no simulator, no emulator, no device — see the
 * handoff). But the defect class has a signature that IS measurable on web, because the two text
 * engines diverge on one specific condition and diverge PREDICTABLY:
 *
 *   When a single word is wider than its container, CSS (`overflow-wrap: normal`) lets the word
 *   OVERFLOW the box — so on web nothing appears wrong and the sweeps pass. iOS instead breaks the
 *   word mid-character. "REMATCH" became "REMATC / H" exactly here.
 *
 * So the web tell for a native break is: A TEXT NODE WHOSE CONTENT IS WIDER THAN ITS BOX. That is
 * `scrollWidth > clientWidth` on a non-wrapping single word, and it is what this measures — every
 * candidate label, at 320pt where the boxes are tightest.
 *
 * This is a DETECTOR, not a proof: it flags what would break on iOS given the same font metrics,
 * and the fonts are not identical. Every hit still has to be looked at. It is the difference
 * between "we cannot test native" and "we cannot test native, so here is the list".
 *
 *   node tools/native-text-sweep.mjs
 */
import fs from 'node:fs';
import { serve, launch } from './content-lib.mjs';

const PORT = Number(process.env.PORT || 8989);
const DIST = process.env.DIST || 'web-tie-dist';
const ROUTES = (process.env.ROUTES || '/,/settings,/orientation-pick,/theme-pick,/lobby,/rank,/stats,/achievements,/hand-history,/coaching,/referral,/missions,/shop,/leaderboard').split(',');

const server = await serve(DIST, PORT);
const browser = await launch();
const seed = JSON.stringify((() => {
  const j = JSON.parse(fs.readFileSync('tests/caps-onboarded.json', 'utf8'));
  const st = JSON.parse(j.origins[0].localStorage.find((e) => e.name === 'caps-poker-storage').value);
  st.state.visualTheme = 'classic'; return st; })());

const DETECT = `() => {
  const out = [];
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
  for (const el of document.querySelectorAll('*')) {
    if (!vis(el)) continue;
    const kids = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
    if (!kids.length) continue;
    const text = el.textContent.trim().replace(/\\s+/g, ' ');
    // Only SINGLE WORDS can break mid-word; a multi-word string wraps at a space on both engines.
    const longest = text.split(/\\s+/).sort((a, b) => b.length - a.length)[0] || '';
    if (longest.length < 4) continue;
    // Measure the longest word on its own, in this element's exact font.
    const cs = getComputedStyle(el);
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;left:-9999px;white-space:pre;visibility:hidden';
    probe.style.font = cs.font;
    probe.style.letterSpacing = cs.letterSpacing;
    probe.style.fontWeight = cs.fontWeight;
    probe.style.fontSize = cs.fontSize;
    probe.style.fontFamily = cs.fontFamily;
    probe.textContent = longest;
    document.body.appendChild(probe);
    const wordW = probe.getBoundingClientRect().width;
    probe.remove();
    const box = el.getBoundingClientRect().width
      - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
    if (wordW > box + 0.5) {
      out.push({ text: text.slice(0, 44), word: longest, wordW: +wordW.toFixed(1),
                 box: +box.toFixed(1), over: +(wordW - box).toFixed(1),
                 size: cs.fontSize, spacing: cs.letterSpacing });
    }
  }
  return out;
}`;

const hits = [];
const blind = [];
for (const route of ROUTES) {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 852 } });
  await ctx.route('**/*', (r) => (/supabase\.co|ftable\.co\.il/i.test(r.request().url()) ? r.abort() : r.continue()));
  const page = await ctx.newPage();
  await page.addInitScript((b) => { try { localStorage.setItem('has_seen_interactive_tutorial','true');
    localStorage.setItem('caps_games_played','25'); localStorage.setItem('caps-poker-storage', b); } catch(_){} }, seed);
  try {
    await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(3500);
    const found = await page.evaluate(`(${DETECT})()`);
    // A BLANK PAGE IS "CLEAN" FOR THE WORST POSSIBLE REASON. Every route reports how much text it
    // actually rendered, so a zero-hit result on an empty screen cannot pass as a pass.
    const rendered = await page.evaluate(`(() => { const t = [...document.querySelectorAll('*')]
      .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
      return { nodes: t.length, sample: (document.body.innerText || '').trim().replace(/\\s+/g,' ').slice(0,54) }; })()`);
    // SELF-TEST: inject a word that MUST be flagged. If the detector cannot see a planted
    // positive on this very page, its "clean" verdict on this page is worthless.
    const canary = await page.evaluate(`(() => {
      const d = document.createElement('div');
      d.style.cssText = 'width:40px;font:900 22px system-ui;letter-spacing:3px';
      d.textContent = 'CANARYOVERFLOWWORD';
      document.body.appendChild(d); d.id = '__canary'; return true; })()`);
    const withCanary = await page.evaluate(`(${DETECT})()`);
    const caught = withCanary.some((h) => h.word === 'CANARYOVERFLOWWORD');
    await page.evaluate(`(() => document.getElementById('__canary')?.remove())()`);
    for (const f of found) hits.push({ route, ...f });
    console.log(`  ${route.padEnd(18)} ${String(rendered.nodes).padStart(4)} text nodes  ` +
      `detector:${caught ? 'PROVEN' : 'BLIND'}  ${found.length ? `${found.length} AT RISK` : 'clean'}` +
      `${rendered.nodes < 5 ? `   <-- BARELY RENDERED: "${rendered.sample}"` : ''}`);
    if (!caught) blind.push(route);
  } catch (e) { console.log(`  ${route.padEnd(20)} could not load — ${String(e).split('\n')[0].slice(0, 60)}`); }
  await ctx.close();
}
await browser.close(); server.close();

console.log(`\n══ WORDS WIDER THAN THEIR BOX AT 320pt — these overflow on web and BREAK MID-WORD on iOS ══`);
if (!hits.length) console.log('  none');
for (const h of hits) {
  console.log(`  ${h.route.padEnd(18)} "${h.word}" ${h.wordW}px in a ${h.box}px box (over by ${h.over}px)  ${h.size}/${h.spacing}`);
  if (h.text !== h.word) console.log(`      full text: "${h.text}"`);
}
fs.writeFileSync('/tmp/native-text-sweep.json', JSON.stringify(hits, null, 2));
console.log(`\n  ${hits.length} at risk across ${ROUTES.length} routes`);
if (blind.length) console.log(`  DETECTOR WAS BLIND on: ${blind.join(', ')} — their "clean" means nothing`);
console.log('');
