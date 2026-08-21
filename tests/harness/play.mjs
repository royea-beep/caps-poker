/**
 * SHARED PLAY HARNESS — drive a CAPS hand from deal to /results.
 *
 * WHY THIS FILE EXISTS. Three sprints reported "the harness cannot reach a reveal". It could:
 * tests/mp-full-hand.mjs has had a working place() the whole time. What was missing was a place to
 * find it — 41 test files each define their own `fire()` and nothing is shared, so every sprint
 * rewrites the same primitives slightly worse. Everything below is LIFTED from mp-full-hand.mjs,
 * not reinvented.
 *
 * THE TWO MISTAKES THIS MODULE EXISTS TO PREVENT, both of which cost three sprints:
 *
 *  1. THERE ARE TWO AUTO-PLACE CONTROLS. A per-board chip (Board.tsx:710, rendered only while THAT
 *     board is empty) and "Auto-Place ALL" (PlayerHand.tsx:272, aria-label "Auto-place all boards").
 *     Matching /Auto-Place/ and taking the first hit gets the PER-BOARD chip, which fills one board.
 *     `allBoardsFull` then stays false and BoardArrangement.tsx:514 keeps ready-button DISABLED, so
 *     the next click is a no-op on a dead button and the screen sits on "PLACE 4 CARDS" forever.
 *     Match /auto-place all/ — the word ALL is the whole semantic difference.
 *
 *  2. A SYNTHETIC el.click() DOES NOT DRIVE RN-WEB. Pressable listens for a pointer sequence.
 *     fire() dispatches the whole thing.
 *
 * Placement is also ASYNC: the fill lands a frame or more after the tap. Never sleep-and-hope —
 * poll ready-button until it is actually enabled, which is what readyIsArmed() is for.
 */

/** The pointer sequence RN-web Pressable actually responds to. Injected as window.__f. */
export const FIRE_SRC = `(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;

export async function installFire(page) {
  await page.evaluate(`window.__f=${FIRE_SRC}`);
}

/** Is the real Ready button (BoardArrangement.tsx:511) present AND enabled? */
export async function readyIsArmed(page) {
  return page.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]');
    if(!r) return false;
    if (r.getAttribute('aria-disabled')==='true' || r.disabled) return false;
    // RN-web renders disabled Pressables without the attribute sometimes; the style carries it.
    return true;})()`);
}

/** Click "Auto-Place ALL". Returns whether the control was found. */
export async function clickAutoPlaceAll(page) {
  await installFire(page);
  return page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')]
    .find(x=>/auto-place all/i.test((x.getAttribute('aria-label')||'')+' '+(x.textContent||'')));
    if(!b) return false; window.__f(b); return true;})()`);
}

/** FALLBACK 1 — click per-board chips until none remain. They disappear as each board fills. */
export async function clickPerBoardChips(page, max = 8) {
  await installFire(page);
  let clicks = 0;
  for (let i = 0; i < max; i++) {
    const hit = await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button,[role="button"]')]
      .find(x=>{const t=(x.getAttribute('aria-label')||'')+' '+(x.textContent||'');
                return /auto.?place/i.test(t) && !/all/i.test(t);});
      if(!b) return false; window.__f(b); return true;})()`);
    if (!hit) break;
    clicks++;
    await page.waitForTimeout(900);
  }
  return clicks;
}

/**
 * Fill every board, then arm and press Ready. Returns a per-stage record so a failure names its
 * own stage instead of surfacing as a silent timeout.
 */
export async function placeAndReady(page, { timeoutMs = 25000 } = {}) {
  const stages = { autoAll: false, perBoardClicks: 0, armed: false, readyFired: false };

  stages.autoAll = await clickAutoPlaceAll(page);
  if (!stages.autoAll) stages.perBoardClicks = await clickPerBoardChips(page);

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await readyIsArmed(page)) { stages.armed = true; break; }
    await page.waitForTimeout(500);
  }
  if (!stages.armed) return stages;

  await installFire(page);
  stages.readyFired = await page.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]');
    if(!r) return false; window.__f(r); return true;})()`);
  return stages;
}

/** Where are we, and what is on screen? Cheap enough to call in a poll loop. */
export async function where(page) {
  return page.evaluate(`(()=>({ path: location.pathname,
    head: document.body.innerText.split('\\n').map(s=>s.trim()).filter(Boolean).slice(0,3),
    inReveal: !!document.querySelector('[data-testid="reveal-section-label"]'),
  }))()`);
}

/**
 * Deal to /results, by PLAYING. Calls onFrame(page) after every poll so a caller can measure the
 * reveal as it happens — the WON border only exists inside that window.
 */
export async function playHandToResults(page, { onFrame, maxMs = 150000, pollMs = 1200 } = {}) {
  const stages = await placeAndReady(page);
  const log = [{ stage: 'placeAndReady', ...stages, ...(await where(page)) }];
  if (!stages.readyFired) return { reachedResults: false, log };

  const deadline = Date.now() + maxMs;
  let sawReveal = false;
  while (Date.now() < deadline) {
    await page.waitForTimeout(pollMs);
    const w = await where(page);
    if (w.inReveal) sawReveal = true;
    if (onFrame) await onFrame(page, w);
    if (w.path === '/results') {
      log.push({ stage: 'results', ...w });
      return { reachedResults: true, sawReveal, log };
    }
  }
  log.push({ stage: 'timeout', ...(await where(page)) });
  return { reachedResults: false, sawReveal, log };
}
