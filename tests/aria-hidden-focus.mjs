/**
 * "Blocked aria-hidden on an element because its descendant retained focus."
 *
 * Reproduces the warning on the live lobby and identifies WHO sets the aria-hidden — our code
 * or react-navigation. Our own aria-hidden usages are all on decorative emoji <Text>; none wrap
 * a button. The reported container has background rgb(242,242,242), which is react-navigation's
 * screen background, so the hypothesis is the outgoing screen being hidden while focus is still
 * inside it. Hypothesis, not conclusion — this measures it.
 *
 * Reports the full ancestor chain of the focused element with each level's aria-hidden, inert,
 * background and class, so the owner is identifiable rather than guessed.
 *
 *   node tests/aria-hidden-focus.mjs
 */
import { chromium } from 'playwright';
import { measure, HarnessError } from './probe-kit.mjs';

const URL = process.env.CAPS_URL || 'https://caps.ftable.co.il';
const SEED = { caps_tutorial_seen: 'true', caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true', caps_games_played: '99' };

const browser = await chromium.launch({ headless: false, args: ['--window-size=410,900'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 812 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch {} } }, SEED);
const page = await ctx.newPage();

const msgs = [];
page.on('console', (m) => { const t = m.text(); if (/aria-hidden|inert|assistive/i.test(t)) msgs.push(`[${m.type()}] ${t.slice(0, 200)}`); });

// Navigate home -> lobby so a screen transition actually occurs; the warning is about an
// OUTGOING screen being hidden, so landing on /lobby directly may never trigger it.
await page.goto(URL, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(10000);
await page.goto(URL + '/lobby', { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(9000);

// Tab into the page so something is focused, then navigate away — that is the exact sequence
// the warning describes (focus retained inside a container that gets hidden).
for (let i = 0; i < 4; i++) { await page.keyboard.press('Tab'); await page.waitForTimeout(300); }

const focused = await measure(page, `(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return { none: true };
  const chain = [];
  let n = el, d = 0;
  while (n && d < 10) {
    const cs = getComputedStyle(n);
    chain.push({ tag: n.tagName.toLowerCase(),
                 ariaHidden: n.getAttribute('aria-hidden'),
                 inert: n.hasAttribute('inert'),
                 bg: cs.backgroundColor,
                 cls: (n.className || '').toString().slice(0, 44) });
    n = n.parentElement; d++;
  }
  return { text: (el.textContent || '').trim().slice(0, 40), tag: el.tagName.toLowerCase(), chain };
})()`, { label: 'focus' });

// page.goto is a full reload, NOT a react-navigation transition — it could never trigger the
// warning, which is about an outgoing SCREEN being hidden. Drive an in-app navigation instead,
// with focus still held, which is the exact sequence the console describes.
const back = await measure(page, `(() => {
  const b = [...document.querySelectorAll('button,[role="button"],a')]
    .find((e) => /back/i.test((e.getAttribute('aria-label') || '') + ' ' + (e.textContent || '')));
  if (!b) return null;
  const r = b.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const mk = (t, C) => new C(t, { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', button: 0, buttons: t.includes('up') ? 0 : 1, isPrimary: true });
  ['pointerdown','mousedown','pointerup','mouseup','click'].forEach((t) => b.dispatchEvent(mk(t, t.startsWith('pointer') ? PointerEvent : MouseEvent)));
  return (b.textContent || '').trim().slice(0, 20);
})()`, { label: 'back' });
console.log(`\nin-app back navigation via ${JSON.stringify(back)}`);
await page.waitForTimeout(5000);
await browser.close();

if (focused.none) { console.log('nothing was focused after tabbing — inconclusive, not a pass.'); }
else {
  console.log(`focused element: <${focused.tag}> ${JSON.stringify(focused.text)}\n`);
  console.log('ancestor chain (leaf -> root):');
  focused.chain.forEach((c, i) => console.log(
    `  ^${i} <${c.tag}> aria-hidden=${c.ariaHidden ?? '-'} inert=${c.inert} bg=${c.bg} cls=${c.cls}`));
  const hidden = focused.chain.find((c) => c.ariaHidden === 'true');
  console.log(hidden
    ? `\n>>> FOUND: an ancestor <${hidden.tag}> has aria-hidden="true" while this element is focused. bg=${hidden.bg}`
    : '\n>>> no aria-hidden ancestor found at this instant — the warning may only fire mid-transition.');
}
console.log(`\naria-hidden console messages captured: ${msgs.length}`);
msgs.slice(0, 4).forEach((m) => console.log('  ' + m));
