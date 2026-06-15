const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const MAP = [{ n: 2, bc: 4 }, { n: 3, bc: 3 }, { n: 4, bc: 2 }];
const W = [440, 390, 320];
const QA_DIR = path.resolve(__dirname, '..', 'qa');
if (!fs.existsSync(QA_DIR)) fs.mkdirSync(QA_DIR, { recursive: true });

/**
 * VAMOS-CENTER-FIX 2026-06-15 — extended measurement.
 * Reads testID'd nodes (data-testid in RN Web) via getBoundingClientRect
 * and getComputedStyle so we get NUMBERS instead of eyeballing pixels.
 *   testIDs added in Board.tsx + PlayerHand.tsx:
 *     board-{idx}, community-row-{idx}, slot-row-{idx}, hand-row, hand-card
 */
async function measure(page) {
  return await page.evaluate(() => {
    const VW = window.innerWidth;
    function rect(el) {
      const r = el.getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) };
    }
    const boards = [...document.querySelectorAll('[data-testid^="board-"]')];
    const handRow = document.querySelector('[data-testid="hand-row"]');
    const handCards = [...document.querySelectorAll('[data-testid="hand-card"]')];

    // Money pill: find the '💰' emoji as anchor, then read parent View bg/border + numeric Text color.
    let moneyPillColor = null;
    {
      const candidates = [...document.querySelectorAll('div')];
      for (const el of candidates) {
        const tx = (el.innerText || '').trim();
        if (tx.startsWith('💰') && tx.length < 20) {
          const txtChild = [...el.childNodes].find(n => n.nodeType === 1 && /\d/.test(n.textContent));
          if (txtChild) {
            const cs = getComputedStyle(txtChild);
            const csBg = getComputedStyle(el);
            moneyPillColor = { amountColor: cs.color, pillBg: csBg.backgroundColor, pillBorder: csBg.borderColor };
            break;
          }
        }
      }
    }

    const boardData = boards.map(b => {
      const idx = (b.getAttribute('data-testid') || '').replace('board-', '');
      const commRow = document.querySelector(`[data-testid="community-row-${idx}"]`);
      const slotRow = document.querySelector(`[data-testid="slot-row-${idx}"]`);
      const br = rect(b);
      const cr = commRow ? rect(commRow) : null;
      const sr = slotRow ? rect(slotRow) : null;
      return {
        idx,
        boardRect: br,
        communityRow: cr ? {
          rect: cr,
          leftOffsetInBoard: cr.left - br.left,
          rightOffsetInBoard: br.right - cr.right,
          centeringDelta: (cr.left - br.left) - (br.right - cr.right),
        } : null,
        slotRow: sr ? {
          rect: sr,
          leftOffsetInBoard: sr.left - br.left,
          rightOffsetInBoard: br.right - sr.right,
          centeringDelta: (sr.left - br.left) - (br.right - sr.right),
        } : null,
      };
    });

    // VAMOS-HAND-CLIP-2 — measure CARD extents (min(left), max(right) across all
    // hand-card nodes) vs viewport. The hand-row container has overflow:hidden
    // which masks card overflow — the prior "container clip" check was useless.
    const handData = handRow ? (() => {
      const hr = rect(handRow);
      const cards = handCards.map(rect);
      const cardWidths = cards.map(c => c.w);
      const minW = cardWidths.length ? Math.min(...cardWidths) : null;
      const maxW = cardWidths.length ? Math.max(...cardWidths) : null;
      const minLeft = cardWidths.length ? Math.min(...cards.map(c => c.left)) : null;
      const maxRight = cardWidths.length ? Math.max(...cards.map(c => c.right)) : null;
      const cardSpan = (minLeft != null && maxRight != null) ? (maxRight - minLeft) : null;
      const cardLeftOverflow = (minLeft != null) ? Math.max(0, 0 - minLeft) : null;
      const cardRightOverflow = (maxRight != null) ? Math.max(0, maxRight - VW) : null;
      return {
        rect: hr,
        containerLeftMargin: hr.left,
        containerRightMargin: VW - hr.right,
        containerClip: hr.left < 0 || hr.right > VW,
        cardCount: cards.length,
        cardWmin: minW,
        cardWmax: maxW,
        cardWavg: cards.length ? Math.round(cardWidths.reduce((s, x) => s + x, 0) / cards.length) : null,
        // NEW: real card-extent measurements
        cardMinLeft: minLeft,
        cardMaxRight: maxRight,
        cardSpan,
        cardLeftMargin: (minLeft != null) ? minLeft : null,
        cardRightMargin: (maxRight != null) ? (VW - maxRight) : null,
        cardClip: (cardLeftOverflow > 0) || (cardRightOverflow > 0),
        cardLeftOverflow,
        cardRightOverflow,
      };
    })() : null;

    return { VW, boardData, handData, moneyPillColor };
  });
}

(async () => {
  const browser = await chromium.launch();
  const allResults = [];
  for (const { n, bc } of MAP) {
    for (const w of W) {
      // VAMOS-HAND-CLIP-2 — fresh context per iteration so SCREEN_W in the Expo Web
      // app (Dimensions.get at module load) matches the actual viewport. Seed
      // localStorage by visiting / first, write numberOfPlayers, then deep-link /game.
      const ctx = await browser.newContext({ viewport: { width: w, height: 956 }, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      await page.goto('https://caps.ftable.co.il/', { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1500); // let zustand-persist write its initial state
      await page.evaluate((n) => {
        try {
          const k = 'caps-poker-storage';
          const existing = localStorage.getItem(k);
          if (existing) {
            const o = JSON.parse(existing);
            o.state.config = o.state.config || {};
            o.state.config.numberOfPlayers = n;
            localStorage.setItem(k, JSON.stringify(o));
          }
        } catch (e) { /* ignore */ }
      }, n);
      await page.goto('https://caps.ftable.co.il/game', { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2600);

      const fn = `qa/qa-bc${bc}-${w}.png`;
      await page.screenshot({ path: fn });
      const m = await measure(page);
      allResults.push({ bc, n, width: w, file: fn, ...m });
      const h = m.handData;
      const board0 = m.boardData?.[0];
      const cr = board0?.communityRow;
      const sr = board0?.slotRow;
      const handLine = h ? `hand[cardSpan=${h.cardSpan},cardL=${h.cardLeftMargin},cardR=${h.cardRightMargin},cardClip=${h.cardClip},Loverflow=${h.cardLeftOverflow},Roverflow=${h.cardRightOverflow},n=${h.cardCount},Wavg=${h.cardWavg}]` : 'hand[none]';
      const boardLine = cr ? `b0comm[L=${cr.leftOffsetInBoard},R=${cr.rightOffsetInBoard},Δ=${cr.centeringDelta}]` : 'b0comm[none]';
      const slotLine = sr ? `b0slot[L=${sr.leftOffsetInBoard},R=${sr.rightOffsetInBoard},Δ=${sr.centeringDelta}]` : 'b0slot[none]';
      console.log(`bc=${bc} w=${w} | ${handLine} | ${boardLine} | ${slotLine} | money.amount=${m.moneyPillColor?.amountColor || 'n/a'}`);
      await ctx.close();
    }
  }
  await browser.close();

  // Findings markdown
  const md = [];
  md.push('# CAPS Placement-Matrix Auto-QA Findings (numeric)');
  md.push('');
  md.push(`Generated: ${new Date().toISOString()}`);
  md.push(`Base URL: https://caps.ftable.co.il/game`);
  md.push('');
  md.push('## Hand row — CARD extents vs viewport (VAMOS-HAND-CLIP-2)');
  md.push('');
  md.push('The hand-row container has `overflow:hidden`, so its rect always "fits" by definition. Real clip is whether any **card** extent breaks the viewport. **cardClip = (cardLeftOverflow > 0 OR cardRightOverflow > 0).**');
  md.push('');
  md.push('| bc | width | VW | card span | card L margin | card R margin | cardClip | L overflow | R overflow | cards | W avg |');
  md.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of allResults) {
    const h = r.handData || {};
    md.push(`| ${r.bc} | ${r.width} | ${r.VW || r.width} | ${h.cardSpan ?? '?'} | ${h.cardLeftMargin ?? '?'} | ${h.cardRightMargin ?? '?'} | ${h.cardClip ?? '?'} | ${h.cardLeftOverflow ?? '?'} | ${h.cardRightOverflow ?? '?'} | ${h.cardCount ?? '?'} | ${h.cardWavg ?? '?'} |`);
  }
  md.push('');
  md.push('## Board 0 — community row centering inside board');
  md.push('');
  md.push('Δ = L − R. **Δ near 0 ⇒ centered.** Positive = pushed right; negative = pushed left.');
  md.push('');
  md.push('| bc | width | board W | comm L | comm R | Δ | comm W | board H |');
  md.push('|---|---|---|---|---|---|---|---|');
  for (const r of allResults) {
    const b = r.boardData?.[0];
    const cr = b?.communityRow;
    md.push(`| ${r.bc} | ${r.width} | ${b?.boardRect.w ?? '?'} | ${cr?.leftOffsetInBoard ?? '?'} | ${cr?.rightOffsetInBoard ?? '?'} | ${cr?.centeringDelta ?? '?'} | ${cr?.rect?.w ?? '?'} | ${b?.boardRect.h ?? '?'} |`);
  }
  md.push('');
  md.push('## Board 0 — slot row centering inside board');
  md.push('');
  md.push('| bc | width | board W | slot L | slot R | Δ |');
  md.push('|---|---|---|---|---|---|');
  for (const r of allResults) {
    const b = r.boardData?.[0];
    const sr = b?.slotRow;
    md.push(`| ${r.bc} | ${r.width} | ${b?.boardRect.w ?? '?'} | ${sr?.leftOffsetInBoard ?? '?'} | ${sr?.rightOffsetInBoard ?? '?'} | ${sr?.centeringDelta ?? '?'} |`);
  }
  md.push('');
  md.push('## Money pill resolved color');
  md.push('');
  md.push('| bc | width | amount color | pill bg | pill border |');
  md.push('|---|---|---|---|---|');
  for (const r of allResults) {
    const m = r.moneyPillColor || {};
    md.push(`| ${r.bc} | ${r.width} | ${m.amountColor || '—'} | ${m.pillBg || '—'} | ${m.pillBorder || '—'} |`);
  }
  fs.writeFileSync(path.join(QA_DIR, 'placement-findings.md'), md.join('\n'));
  console.log(`wrote qa/placement-findings.md`);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
