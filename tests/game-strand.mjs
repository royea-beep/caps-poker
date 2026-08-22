/**
 * Can a player be stranded, or lose a hand, by leaving mid-hand? And is /gameover honest?
 *
 * A. LEAVE DURING THE REVEAL. "Leave game" is exposed in EVERY phase including the reveal. The
 *    outbox protects the record only from /results — if the player leaves before results mounts,
 *    nothing was ever queued. This plays to the reveal, taps Leave, and reports where it lands;
 *    the hand_history row is then asserted in SQL against the printed device id.
 *
 * B. /gameover. Handoffs 87 and 93 filed "Not enough chips to continue" rendered above a real
 *    balance as a contradiction. gameover is only routed to from results when
 *    !canAffordMatch(...), so in the real flow the sentence is TRUE. This checks whether the
 *    filed observation came from navigating to the URL directly, which is a probe artifact.
 *
 *   node tests/game-strand.mjs
 */
import { webkit, chromium } from 'playwright';
import { installFire, where } from './harness/play.mjs';

const SITE = process.env.CAPS_URL || 'https://caps.ftable.co.il';

for (const [name, engine, vw] of [['webkit', webkit, 430], ['chromium', chromium, 393]]) {
  const b = await engine.launch({ headless: false });
  const p = await (await b.newContext({ viewport: { width: vw, height: 900 } })).newPage();
  const dialogs = [];
  p.on('dialog', async (d) => { dialogs.push(`${d.type()}: ${d.message().slice(0, 70)}`); await d.dismiss(); });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 80)));

  // ── A. leave during the reveal ────────────────────────────────────────────
  await p.goto(`${SITE}/game?practice=true&players=3&fresh=1`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(11000);
  const device = await p.evaluate(`localStorage.getItem('caps-device-id')`);

  await installFire(p);
  await p.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')]
    .find(x=>/auto-place all/i.test((x.getAttribute('aria-label')||'')+' '+(x.textContent||''))); if(b) window.__f(b);})()`);
  await p.waitForTimeout(3000);
  await installFire(p);
  await p.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]'); if(r) window.__f(r);})()`);

  let inReveal = false;
  for (let i = 0; i < 30 && !inReveal; i++) { await p.waitForTimeout(900); inReveal = (await where(p)).inReveal; }

  await installFire(p);
  const leftAt = await p.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')]
    .find(x=>/leave game/i.test((x.getAttribute('aria-label')||'')+' '+(x.textContent||'')));
    if(!b) return false; window.__f(b); return true;})()`);
  await p.waitForTimeout(7000);
  const after = await p.evaluate(() => ({
    path: location.pathname,
    head: document.body.innerText.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 4),
    queued: (() => { try { return JSON.parse(localStorage.getItem('caps_hand_outbox') || '[]').length; } catch { return -1; } })(),
  }));
  console.log(`\n══ ${name}/${vw} · A. LEAVE DURING THE REVEAL`);
  console.log(`   reached reveal=${inReveal}  tapped Leave=${leftAt}  dialogs=${JSON.stringify(dialogs)}`);
  console.log(`   landed on: ${after.path}  ${JSON.stringify(after.head)}`);
  console.log(`   hands queued locally: ${after.queued}`);
  console.log(`   ASSERT: select count(*) from hand_history where device_id='${device}';`);

  // ── B. /gameover ──────────────────────────────────────────────────────────
  await p.goto(SITE + '/gameover', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(8000);
  const go = await p.evaluate(() => {
    const lines = document.body.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
    return {
      lines: lines.slice(0, 8),
      exposed: [...document.querySelectorAll('button,[role="button"]')].filter(vis)
        .map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30)),
      bare: [...document.querySelectorAll('[tabindex="0"]')].filter(vis)
        .filter((e) => !e.getAttribute('role') && e.tagName !== 'BUTTON')
        .map((e) => (e.textContent || '').trim().slice(0, 30)),
    };
  });
  console.log(`\n══ ${name}/${vw} · B. /gameover reached by URL`);
  console.log(`   sees: ${JSON.stringify(go.lines)}`);
  console.log(`   EXPOSED(${go.exposed.length}): ${JSON.stringify(go.exposed)}`);
  console.log(`   UNEXPOSED(${go.bare.length}): ${JSON.stringify(go.bare)}`);
  console.log(`   pageerrors=${errs.length}   DEVICE: ${device}`);
  await b.close();
}
