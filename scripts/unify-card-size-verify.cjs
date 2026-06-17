'use strict';
/**
 * UNIFY-CARD-SIZE verification — bc∈{2,3,4} @ width 393
 * Proofs:
 *   1. Board card width == Hand card width (within ±1pt)
 *   2. Hand row count: bc=2→2, bc=3→2, bc=4→3
 *   3. Boards zone height > Hand zone height
 *   4. bc=4: boards scroll (content overflows scrollable zone)
 * Read-only / no edits.
 */
const { chromium } = require('../node_modules/playwright/index.js');
const fs = require('fs');

const BASE_URL = 'http://localhost:8082';
const OUT_DIR  = 'C:/Temp';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// numberOfPlayers → boardCount mapping: 2→4, 3→3, 4→2
const CASES = [
  { np: 4, bc: 2, expectedHandRows: 2 },
  { np: 3, bc: 3, expectedHandRows: 2 },
  { np: 2, bc: 4, expectedHandRows: 3 },
];
const W = 393;
const VP_H = Math.round(W * 852 / 393); // 852

function makeGS(np) {
  return JSON.stringify({
    state: {
      chips: 1200, bestChips: 1200,
      config: {
        numberOfPlayers: np,
        potPerBoard: 25, arrangementTime: 60, boardRevealDuration: 5,
        turnRevealDelay: 800, completeBonusDisplay: 3, startingChips: 1000,
        completeBonusPercent: 50, botSpeedMin: 1500, botSpeedMax: 4000,
        soundEnabled: false, soundVolume: 0, revealSpeed: 'normal', botDifficulty: 'easy',
      },
      handsPlayed: 99, handsWon: 60, biggestWin: 75,
      playerName: 'Player', playerAvatar: 'P',
      notificationsEnabled: false, cardTheme: 'v1', homeTheme: 'dark_gold',
      buttonStyle: 'solid', friendsBg: 'none', fourColorSuits: false,
      colorblindMode: false, handSortMethod: 'caps', orientation: 'portrait',
      visualTheme: 'classic', lastDailyRewardClaim: null, dailyRewardStreak: 0,
      lastFreeRefill: null, totalChipsEarned: 200, totalChipsSpent: 100,
      unlockedAchievements: [], currentWinStreak: 2, bestWinStreak: 3,
    },
    version: 0,
  });
}

async function measureAll(page) {
  return await page.evaluate(() => {
    function rct(el) {
      const r = el.getBoundingClientRect();
      return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height };
    }

    // ---- Proof 1: Board card width (first non-separator child of community-row-0) ----
    const commRow0 = document.querySelector('[data-testid="community-row-0"]');
    let boardCardW = null;
    if (commRow0) {
      const children = [...commRow0.children].filter(c => {
        const w = c.getBoundingClientRect().width;
        return w > 5; // skip zero-width separators
      });
      if (children.length > 0) {
        boardCardW = Math.round(children[0].getBoundingClientRect().width);
      }
    }

    // ---- Proof 1: Hand card width (first hand-card element) ----
    const handCards = [...document.querySelectorAll('[data-testid="hand-card"]')];
    let handCardW = null;
    if (handCards.length > 0) {
      handCardW = Math.round(handCards[0].getBoundingClientRect().width);
    }

    // ---- Proof 2: Hand row count (count distinct top positions of hand-card elements) ----
    let handRows = null;
    if (handCards.length > 0) {
      const tops = new Set(handCards.map(c => Math.round(c.getBoundingClientRect().top)));
      handRows = tops.size;
    }

    // ---- Proof 3: Boards zone height vs Hand zone height ----
    // Boards zone: the element with testid="board-0" lives inside a scrollable container.
    // Walk up from board-0 to find the ScrollView (overflow scroll/auto, meaningful height).
    // Hand zone: the element with testid="hand-row" parent container.
    const board0 = document.querySelector('[data-testid="board-0"]');
    let boardsZoneH = null;
    let boardsScrollH = null;
    let boardsClientH = null;
    if (board0) {
      let el = board0.parentElement;
      while (el && el !== document.body) {
        const style = window.getComputedStyle(el);
        const overflow = style.overflow + style.overflowY;
        const h = el.getBoundingClientRect().height;
        if ((overflow.includes('scroll') || overflow.includes('auto')) && h > 50) {
          boardsZoneH = Math.round(h);
          boardsScrollH = el.scrollHeight;
          boardsClientH = el.clientHeight;
          break;
        }
        el = el.parentElement;
      }
      // Fallback: measure the immediate parent of board-0
      if (boardsZoneH === null && board0.parentElement) {
        boardsZoneH = Math.round(board0.parentElement.getBoundingClientRect().height);
      }
    }

    const handRow = document.querySelector('[data-testid="hand-row"]');
    let handZoneH = null;
    if (handRow) {
      // Walk up to find a meaningful container (> 60px tall)
      let el = handRow.parentElement;
      while (el && el !== document.body) {
        const h = el.getBoundingClientRect().height;
        if (h > 60) {
          handZoneH = Math.round(h);
          break;
        }
        el = el.parentElement;
      }
      if (handZoneH === null) {
        handZoneH = Math.round(handRow.getBoundingClientRect().height);
      }
    }

    // ---- Proof 4: Boards scroll at bc=4 — board top positions monotonic + content overflows ----
    const boardEls = [0, 1, 2, 3].map(i => document.querySelector(`[data-testid="board-${i}"]`));
    const boardTops = boardEls.map(el => el ? Math.round(el.getBoundingClientRect().top) : null);
    const boardsScrollable = boardsScrollH !== null && boardsClientH !== null
      ? (boardsScrollH > boardsClientH + 5)
      : null;

    // Gather all testids for debugging
    const allTestIds = [...document.querySelectorAll('[data-testid]')].map(e => e.getAttribute('data-testid'));

    return {
      boardCardW,
      handCardW,
      handRows,
      boardsZoneH,
      boardsScrollH,
      boardsClientH,
      boardsScrollable,
      handZoneH,
      boardTops,
      handCardCount: handCards.length,
      commRow0Found: !!commRow0,
      handRowFound: !!handRow,
      board0Found: !!board0,
      allTestIds: allTestIds.slice(0, 40),
    };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const startTotal = Date.now();
  const results = [];

  for (const { np, bc, expectedHandRows } of CASES) {
    const elapsed = (Date.now() - startTotal) / 1000;
    if (elapsed > 330) {
      console.log(`[SKIP] Time budget exceeded (${elapsed.toFixed(0)}s), skipping bc=${bc}`);
      results.push({ bc, skipped: true });
      continue;
    }

    console.log(`\n=== bc=${bc} (np=${np}) w=${W} ===`);

    const ctx = await browser.newContext({
      viewport: { width: W, height: VP_H },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    });
    const page = await ctx.newPage();
    page.on('pageerror', () => {});

    // Patch import.meta in the Expo dev bundle
    await page.route('**/index.ts.bundle**', async (route) => {
      const response = await route.fetch();
      let body = await response.text();
      body = body.replace(/import\.meta/g, '({url:"http://localhost:8082/"})');
      await route.fulfill({ response, body, contentType: 'application/javascript' });
    });

    const gs = makeGS(np);
    await page.addInitScript(function(gs) {
      localStorage.setItem('caps-poker-storage', gs);
      localStorage.setItem('caps_tutorial_seen', 'true');
      localStorage.setItem('caps_onboarding_done', 'true');
      localStorage.setItem('has_seen_interactive_tutorial', 'true');
      localStorage.setItem('caps_language', 'he');
      localStorage.setItem('caps_games_played', '99');
      const now = new Date();
      const wk = 'recap_' + now.getFullYear() + '_' + Math.ceil(now.getDate() / 7);
      localStorage.setItem('recap_week', wk);
      localStorage.setItem('caps_daily_reward_popup_shown', '1');
    }, gs);

    try {
      await page.goto(BASE_URL + '/game', { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(4000);

      const m = await measureAll(page);

      // Screenshot
      const shotPath = `C:/Temp/caps_unify_bc${bc}.png`;
      await page.screenshot({ path: shotPath, fullPage: false });
      console.log(`  [shot] ${shotPath}`);

      // --- Proof 1: board card W == hand card W (±1pt) ---
      const widthDiff = (m.boardCardW !== null && m.handCardW !== null)
        ? Math.abs(m.boardCardW - m.handCardW)
        : null;
      const proof1Pass = widthDiff !== null && widthDiff <= 1;
      console.log(`  [P1] boardCardW=${m.boardCardW}  handCardW=${m.handCardW}  diff=${widthDiff}  → ${proof1Pass ? 'PASS' : 'FAIL'}`);

      // --- Proof 2: hand row count ---
      const proof2Pass = m.handRows === expectedHandRows;
      console.log(`  [P2] handRows=${m.handRows}  expected=${expectedHandRows}  handCardCount=${m.handCardCount}  → ${proof2Pass ? 'PASS' : 'FAIL'}`);

      // --- Proof 3: boards zone H > hand zone H ---
      const proof3Pass = (m.boardsZoneH !== null && m.handZoneH !== null)
        ? m.boardsZoneH > m.handZoneH
        : null;
      console.log(`  [P3] boardsZoneH=${m.boardsZoneH}  handZoneH=${m.handZoneH}  → ${proof3Pass === true ? 'PASS' : proof3Pass === false ? 'FAIL' : 'N/A'}`);

      // --- Proof 4: bc=4 boards scroll ---
      const isMonotonic = m.boardTops.every((t, i) => i === 0 || t === null || m.boardTops[i - 1] === null || t > m.boardTops[i - 1]);
      const proof4Pass = bc === 4
        ? (m.boardsScrollable === true && isMonotonic)
        : null; // only applicable at bc=4
      if (bc === 4) {
        console.log(`  [P4] boardTops=${JSON.stringify(m.boardTops)}  monotonic=${isMonotonic}`);
        console.log(`       scrollH=${m.boardsScrollH}  clientH=${m.boardsClientH}  overflows=${m.boardsScrollable}  → ${proof4Pass ? 'PASS' : 'FAIL'}`);
      } else {
        // For bc=2/3 verify boards 0..bc-1 are monotonic (boards exist and stack)
        const bcTops = m.boardTops.slice(0, bc);
        const bcMono = bcTops.every((t, i) => i === 0 || t === null || bcTops[i - 1] === null || t > bcTops[i - 1]);
        console.log(`  [P4-n/a for scroll] boardTops(bc tops)=${JSON.stringify(bcTops)}  monotonic=${bcMono}`);
      }

      if (!m.commRow0Found || !m.handRowFound || !m.board0Found) {
        console.log(`  [WARN] missing elements: commRow0=${m.commRow0Found} handRow=${m.handRowFound} board0=${m.board0Found}`);
        console.log(`  [WARN] allTestIds=${JSON.stringify(m.allTestIds)}`);
      }

      results.push({ bc, np, m, proof1Pass, proof2Pass, proof3Pass, proof4Pass, expectedHandRows, widthDiff });
    } catch (e) {
      console.log(`  [ERROR] ${e.message.slice(0, 200)}`);
      results.push({ bc, np, error: e.message });
    }

    await ctx.close();
  }

  await browser.close();

  // ---- FINAL SUMMARY ----
  console.log('\n\n======== UNIFY-CARD-SIZE VERIFICATION SUMMARY ========');
  console.log(`Width: ${W}px  (viewport ${W}x${VP_H})\n`);
  let allPass = true;
  for (const r of results) {
    if (r.skipped) { console.log(`bc=${r.bc}: SKIPPED (time budget)`); continue; }
    if (r.error)   { console.log(`bc=${r.bc}: ERROR — ${String(r.error).slice(0, 100)}`); allPass = false; continue; }
    const { m } = r;
    console.log(`--- bc=${r.bc} (np=${r.np}) ---`);
    console.log(`  P1 Board card W == Hand card W : boardCardW=${m.boardCardW}  handCardW=${m.handCardW}  diff=${r.widthDiff}pt  → ${r.proof1Pass ? 'PASS' : 'FAIL'}`);
    console.log(`  P2 Hand row count              : got=${m.handRows}  expected=${r.expectedHandRows}  → ${r.proof2Pass ? 'PASS' : 'FAIL'}`);
    console.log(`  P3 Boards zone H > Hand zone H : boardsZoneH=${m.boardsZoneH}  handZoneH=${m.handZoneH}  → ${r.proof3Pass === true ? 'PASS' : r.proof3Pass === false ? 'FAIL' : 'N/A'}`);
    if (r.bc === 4) {
      console.log(`  P4 Boards scroll at bc=4       : scrollH=${m.boardsScrollH}  clientH=${m.boardsClientH}  overflows=${m.boardsScrollable}  tops=${JSON.stringify(m.boardTops)}  → ${r.proof4Pass ? 'PASS' : 'FAIL'}`);
    } else {
      console.log(`  P4 (scroll only applies at bc=4)`);
    }
    if (!r.proof1Pass || !r.proof2Pass || r.proof3Pass === false || (r.bc === 4 && !r.proof4Pass)) {
      allPass = false;
    }
    console.log(`  Screenshot: C:/Temp/caps_unify_bc${r.bc}.png`);
    console.log();
  }
  console.log(`Overall: ${allPass ? 'ALL PASS' : 'SOME FAILURES'}`);
  console.log('=======================================================');
})().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
