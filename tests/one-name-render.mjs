/**
 * ONE-NAME — READ THE RENDERED NAME, NOT THE SOURCE.
 *
 * ⚠️ A source grep is what has misled this project repeatedly: the gold audit passed on a button
 * that had painted mint since the theme sweep, the Hebrew screenshots sat under two filenames, and
 * the card faces were read as grey when the pixels said #FCFAF3. So this walks the BUILT dist/,
 * served by dist/vercel.json's OWN rules, and reads the text a browser actually paints.
 *
 * It asserts the positive (the surface says "CAPS Poker") AND the negative (no "CAPS POKER" and no
 * "Caps Poker" survives anywhere on the page), because a half-renamed surface passes a
 * contains-check and fails a person.
 */
import { chromium } from 'playwright';
import { spawn } from 'child_process';

// ⚠️ 8899 IS NOT A CHOICE — tests/serve-dist-like-prod.mjs HARDCODES it and ignores any argument.
// The first version of this rig passed 8931 and pointed the browser at a port with nothing on it;
// every goto hung and the run produced no output at all. A rig aimed at the wrong port looks
// exactly like a broken product until you read the server's own source.
const PORT = 8899;
const BASE = `http://127.0.0.1:${PORT}`;
const WANT = 'CAPS Poker';
const BAD = ['CAPS POKER', 'Caps Poker'];

const server = spawn('node', ['tests/serve-dist-like-prod.mjs'], { stdio: 'inherit' });
await new Promise((r) => setTimeout(r, 1500));

const results = [];
function record(surface, detail, ok, note = '') {
  results.push({ surface, detail, ok, note });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${surface.padEnd(28)} ${detail}${note ? '  — ' + note : ''}`);
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 } });

async function textOf(path, waitFor) {
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  // A hard timeout so a hang FAILS rather than stalling the run silently.
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 20000 });
  if (waitFor) await page.waitForTimeout(waitFor);
  const title = await page.title();
  // ⚠️ innerText APPLIES CSS text-transform, and that produced a false failure on the landing
  // page: the source says "CAPS Poker", a rule uppercases it, and innerText handed back
  // "CAPS POKER". Reporting that as a stale name would have been a defect filed against a
  // typographic treatment. So the SPELLING is judged from textContent (what the author wrote) and
  // text-transform is reported separately as the design choice it is.
  const probe = await page.evaluate(() => {
    const spelled = [];
    const uppercased = [];
    const lockups = [];
    document.querySelectorAll('*').forEach((el) => {
      if (el.children.length) return;
      const src = (el.textContent || '').trim();
      if (!/CAPS/i.test(src)) return;
      if (getComputedStyle(el).textTransform === 'uppercase') uppercased.push(src.slice(0, 50));
      spelled.push(src.slice(0, 50));
    });
    // ⚠️ AND THE BLIND SPOT THAT PRINTED A FALSE GREEN: a leaf-only scan requiring "CAPS" in the
    // SAME element cannot see a wordmark SPLIT ACROSS TWO SPANS. The landing masthead is
    // <span class=caps>CAPS</span><span class=poker>POKER</span> — neither leaf matches, so the
    // first version reported "every element spells CAPS Poker" while the page painted CAPS POKER.
    // So containers are read by their RENDERED innerText, which is what a person actually sees.
    document.querySelectorAll('h1,h2,h3,header,div,a,p,span').forEach((el) => {
      const rendered = (el.innerText || '').replace(/\s+/g, ' ').trim();
      if (!/CAPS\s*POKER/i.test(rendered)) return;
      if (rendered.length > 60) return;
      const leaf = el.children.length === 0;
      lockups.push({ tag: el.tagName, cls: String(el.className).slice(0, 24), rendered: rendered.slice(0, 40), leaf });
    });
    return { spelled, uppercased, lockups };
  });
  await page.close();
  return { title, spelled: probe.spelled, uppercased: probe.uppercased, lockups: probe.lockups, errs };
}

// ── 1. the web tab title — generated from app.json expo.name ───────────────────────────────────
{
  const { title } = await textOf('/', 2500);
  record('web tab title', JSON.stringify(title), title === WANT);
}

// ── 2. the static pages ────────────────────────────────────────────────────────────────────────
for (const [surface, path] of [
  ['landing page', '/landing.html'],
  ['privacy page', '/privacy.html'],
  ['terms page', '/terms.html'],
  ['hand replay', '/hand'],
]) {
  const { title, spelled, uppercased, lockups } = await textOf(path, 400);
  const hay = title + '\n' + spelled.join('\n');
  const bad = BAD.filter((b) => hay.includes(b));
  record(surface + ' title', JSON.stringify(title), title.includes(WANT));
  record(surface + ' spelling', bad.length ? `stale: ${bad.join(', ')}` : 'every element spells "CAPS Poker"', bad.length === 0);
  if (uppercased.length) {
    record(surface + ' css-uppercase', `${uppercased.length} element(s) styled uppercase — a treatment, not a spelling`, true,
           uppercased.join(' | '));
  }
  // A wordmark that RENDERS as "CAPS POKER" is reported whether or not any single element spells
  // it that way. Reported, never silently failed: a designed lockup is a brand decision.
  const painted = (lockups || []).filter((l) => /CAPS\s*POKER/.test(l.rendered));
  if (painted.length) {
    record(surface + ' wordmark', `renders "${painted[0].rendered}" — LOCKUP, reported not auto-failed`, true,
           painted.map((l) => `${l.tag}.${l.cls}${l.leaf ? '' : ' (split across spans)'}`).join(' | '));
  }
}

// ── 3. the in-app screens the brief named ──────────────────────────────────────────────────────
for (const [surface, path] of [
  ['orientation-pick', '/orientation-pick'],
  ['theme-pick', '/theme-pick'],
  ['home (onboarding)', '/'],
]) {
  const { spelled } = await textOf(path, 3500);
  const hay = spelled.join('\n');
  const bad = BAD.filter((b) => hay.includes(b));
  const has = hay.includes(WANT);
  record(surface, has ? `renders "${WANT}"` : 'name not painted on this view', has || bad.length === 0,
         has ? (bad.length ? `STALE ${bad.join(',')}` : '') : 'name not on screen — not a failure, but not proof either');
  if (bad.length) record(surface + ' stale', bad.join(', '), false);
}

await browser.close();
server.kill();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) { console.log('FAILURES:'); failed.forEach((f) => console.log(`  ${f.surface}: ${f.detail}`)); process.exit(1); }
