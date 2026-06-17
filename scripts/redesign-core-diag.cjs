'use strict';
/**
 * REDESIGN-CORE diagnostic — placement screen at bc=4 / bc=3 / bc=2
 * (numberOfPlayers 2→bc=4, 3→bc=3, 4→bc=2)
 * Width 393; also 414, 430 if time budget allows.
 * Read-only / no commits / no edits.
 */
const { chromium } = require('../node_modules/playwright/index.js');
const fs = require('fs');

const BASE_URL = 'http://localhost:8082';
const OUT_DIR  = 'C:/Temp';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// numberOfPlayers → boardCount mapping: 2→4, 3→3, 4→2
const CASES = [
  { np: 2, bc: 4 },
  { np: 4, bc: 2 },
  { np: 3, bc: 3 },
];
const WIDTHS = [393, 414, 430];

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

async function measure(page) {
  return await page.evaluate(() => {
    function rct(el) {
      const r = el.getBoundingClientRect();
      return {
        l: Math.round(r.left), r: Math.round(r.right),
        t: Math.round(r.top),  b: Math.round(r.bottom),
        w: Math.round(r.width), h: Math.round(r.height),
      };
    }

    const board0   = document.querySelector('[data-testid="board-0"]');
    const commRow0 = document.querySelector('[data-testid="community-row-0"]');
    const slotRow0 = document.querySelector('[data-testid="slot-row-0"]');

    if (!board0 || !commRow0 || !slotRow0) {
      const allIds = [...document.querySelectorAll('[data-testid]')].map(e => e.getAttribute('data-testid'));
      return { error: 'missing testid elements', allIds };
    }

    const boardRect = rct(board0);
    const commRect  = rct(commRow0);
    const slotRect  = rct(slotRow0);

    // --- Deck-stub: direct child of commRow0 with aria-label containing "Turn" ---
    const stubEl = commRow0.querySelector('[aria-label*="Turn"]');
    const stubRect = stubEl ? rct(stubEl) : null;

    // --- Flop cards: direct children of commRow0 that are NOT the stub ---
    const commChildren = [...commRow0.children];
    const flopEls = commChildren.filter(c => {
      const label = c.getAttribute('aria-label') || '';
      return !label.includes('Turn') && !label.includes('River');
    });
    // Each flop element is the Card wrapper; its rendered rect gives card W×H
    const flopRects = flopEls.map(rct).filter(r => r.w > 5 && r.h > 5);
    const flopW = flopRects.length
      ? Math.round(flopRects.reduce((s, r) => s + r.w, 0) / flopRects.length)
      : null;
    const flopH = flopRects.length
      ? Math.round(flopRects.reduce((s, r) => s + r.h, 0) / flopRects.length)
      : null;

    // flopTotalW = span from leftmost edge to rightmost edge of flop cards
    const flopLeft  = flopRects.length ? Math.min(...flopRects.map(r => r.l)) : null;
    const flopRight = flopRects.length ? Math.max(...flopRects.map(r => r.r)) : null;
    const flopTotalW = (flopLeft !== null && flopRight !== null) ? flopRight - flopLeft : null;

    // flopTop for overlap check
    const flopTop = flopRects.length ? Math.min(...flopRects.map(r => r.t)) : null;

    // void = boardW - flopTotalW - stubW  (rough horizontal waste)
    const boardW  = boardRect.w;
    const stubW   = stubRect ? stubRect.w : null;
    const voidW   = (flopTotalW !== null && stubW !== null)
      ? boardW - flopTotalW - stubW
      : null;

    // --- Auto-place pill: find ⚡ text node inside board-0, walk up to pill container ---
    let pillBottom = null;
    {
      const all = [...board0.querySelectorAll('*')];
      for (const el of all) {
        if ((el.textContent || '').trim() === '⚡' && el.children.length === 0) {
          const parent = el.parentElement;
          const pr = parent ? rct(parent) : rct(el);
          pillBottom = pr.b;
          break;
        }
      }
    }

    // --- Deal-lane: slot row should be thin (< 50 CSS px) with tick-mark children ---
    const slotChildren = [...slotRow0.children];
    const slotChildRects = slotChildren.map(rct);
    const isDealLaneLike = slotRect.h < 50;

    return {
      VW: window.innerWidth,
      boardW,
      boardH: boardRect.h,
      commRowW: commRect.w,
      flopCount: flopRects.length,
      flopW,
      flopH,
      flopTotalW,
      stubW,
      stubH: stubRect ? stubRect.h : null,
      deckStubFound: !!stubEl,
      deckStubAriaLabel: stubEl ? (stubEl.getAttribute('aria-label') || 'found-no-label') : null,
      voidW,
      slotRowH: slotRect.h,
      slotChildCount: slotChildren.length,
      slotChildHeights: slotChildRects.map(r => r.h),
      isDealLaneLike,
      pillBottom,
      flopTop,
      pillFlopGap: (pillBottom !== null && flopTop !== null) ? flopTop - pillBottom : null,
    };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const report = [];
  const startTotal = Date.now();

  for (const w of WIDTHS) {
    const vpH = Math.round(w * 852 / 393);
    for (const { np, bc } of CASES) {
      const elapsed = (Date.now() - startTotal) / 1000;
      // After 5 min total, only continue if still on first width (393)
      if (elapsed > 300 && w !== 393) {
        console.log(`[SKIP] Time budget (${elapsed.toFixed(0)}s), skipping w=${w} bc=${bc}`);
        continue;
      }

      console.log(`\n=== w=${w} bc=${bc} (np=${np}) ===`);

      const ctx = await browser.newContext({
        viewport: { width: w, height: vpH },
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

      // Collect [board-size] and [board-0] console logs
      const consoleLogs = [];
      page.on('console', (msg) => {
        const txt = msg.text();
        if (txt.includes('[board-size]') || txt.includes('[board-0]')) {
          consoleLogs.push(txt);
        }
      });

      try {
        await page.goto(BASE_URL + '/game', { waitUntil: 'domcontentloaded', timeout: 25000 });
        await page.waitForTimeout(4000);

        const m = await measure(page);

        if (m.error) {
          console.log(`  [measure-error] ${m.error}  allIds=${JSON.stringify(m.allIds)}`);
          report.push({ w, bc, np, error: m.error });
        } else {
          const shotPath = `C:/Temp/caps_redesigncore_bc${bc}_${w}.png`;
          await page.screenshot({ path: shotPath });

          console.log(`  [shot] ${shotPath}`);
          console.log(`  boardW=${m.boardW}  boardH=${m.boardH}  commRowW=${m.commRowW}`);
          console.log(`  flopCards=${m.flopCount}  flopW=${m.flopW}  flopH=${m.flopH}  flopTotalW=${m.flopTotalW}`);
          console.log(`  deckStubFound=${m.deckStubFound}  stubW=${m.stubW}  stubH=${m.stubH}  label="${m.deckStubAriaLabel}"`);
          console.log(`  void(boardW - flopTotalW - stubW)=${m.voidW}`);
          console.log(`  slotRowH=${m.slotRowH}  isDealLane(h<50)=${m.isDealLaneLike}  slotChildren=${m.slotChildCount}  childHs=${JSON.stringify(m.slotChildHeights)}`);
          console.log(`  pillBottom=${m.pillBottom}  flopTop=${m.flopTop}  pillFlopGap=${m.pillFlopGap}`);
          if (consoleLogs.length) {
            console.log(`  [board-size log]: ${consoleLogs[consoleLogs.length - 1]}`);
          } else {
            console.log(`  [board-size log]: (none)`);
          }

          report.push({ w, bc, np, ...m, consoleLogs });
        }
      } catch (e) {
        console.log(`  [ERROR] ${e.message.slice(0, 120)}`);
        report.push({ w, bc, np, error: e.message });
      }

      await ctx.close();
    }
  }

  await browser.close();

  console.log('\n\n=== FINAL SUMMARY ===');
  for (const r of report) {
    if (r.error) {
      console.log(`bc=${r.bc} w=${r.w}: ERROR ${String(r.error).slice(0, 80)}`);
      continue;
    }
    const deckPass  = r.deckStubFound   ? 'PASS' : 'FAIL';
    const lanePass  = r.isDealLaneLike  ? `PASS(h=${r.slotRowH})` : `FAIL(h=${r.slotRowH})`;
    const gapResult = r.pillFlopGap !== null
      ? (r.pillFlopGap >= 0 ? `PASS(gap=${r.pillFlopGap})` : `FAIL(gap=${r.pillFlopGap})`)
      : 'n/a';
    console.log(`bc=${r.bc} w=${r.w}: flop=${r.flopW}x${r.flopH} void=${r.voidW} | deck-stub=${deckPass} | deal-lane=${lanePass} | pill/flopGap=${gapResult}`);
    // bc=4 board-size log
    if (r.bc === 4 && r.consoleLogs && r.consoleLogs.length) {
      for (const l of r.consoleLogs) console.log(`  LOG: ${l}`);
    }
  }
})().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
