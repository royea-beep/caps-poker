/**
 * FILL-PER-MODE verifier: UNIVERSAL_CARD_W per bc∈{2,3,4} @ width 393
 *
 * Proofs per bc:
 *   1. W per mode — board flop card W AND hand card W (must match). W(2)>W(3)>W(4=55).
 *   2. Dead gap — px between board-last bottom and hand-zone top. Expected ≈0 (≤10px).
 *   3. Scroll state — boards ScrollView scrolls only at bc=4.
 *   4. bc=4 boards stacked — Y monotonic, scrollHeight > clientHeight.
 *
 * Run: node tests/fill-per-mode-verify.cjs
 * Requires: expo web running on :8082
 */
'use strict';

const { chromium } = require('playwright');

const EXPO_URL = 'http://localhost:8082';
const VIEWPORT = { width: 393, height: 852 };

const STORAGE = {
  caps_tutorial_seen: 'true',
  caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true',
  caps_language: 'he',
  caps_games_played: '99',
};

function pokerStorage(numberOfPlayers) {
  return JSON.stringify({
    state: {
      config: {
        numberOfPlayers,
        potPerBoard: 25,
        arrangementTime: 30,
        startingChips: 1000,
        boardRevealDuration: 2000,
        completeBonusDisplay: 3000,
        completeBonusPercent: 50,
        turnRevealDelay: 800,
        botSpeedMin: 3000,
        botSpeedMax: 8000,
      },
      chips: 1000,
    },
    version: 0,
  });
}

async function setupPage(page, numberOfPlayers) {
  // Intercept bundles to patch import.meta
  await page.route('**/*.bundle*', async (route) => {
    const resp = await route.fetch();
    let body = await resp.text();
    body = body.replace(/import\.meta\.env/g, '({})');
    body = body.replace(/import\.meta/g, '({})');
    await route.fulfill({ response: resp, body });
  });

  const poker = pokerStorage(numberOfPlayers);

  await page.addInitScript((args) => {
    for (const [k, v] of Object.entries(args.storage)) {
      localStorage.setItem(k, v);
    }
    localStorage.setItem('caps-poker-storage', args.poker);
  }, { storage: STORAGE, poker });

  await page.setViewportSize(VIEWPORT);

  // Seed on root first
  await page.goto(EXPO_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Re-seed after Expo initializes storage
  await page.evaluate((args) => {
    for (const [k, v] of Object.entries(args.storage)) {
      localStorage.setItem(k, v);
    }
    localStorage.setItem('caps-poker-storage', args.poker);
  }, { storage: STORAGE, poker });

  // Navigate to /game
  await page.goto(`${EXPO_URL}/game`, { waitUntil: 'networkidle', timeout: 30000 });
}

async function measureMode(browser, bc, numberOfPlayers) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await setupPage(page, numberOfPlayers);

    // Wait for board to render
    await page.waitForSelector('[data-testid="board-0"]', { timeout: 15000 });

    // Extra settle time for animations
    await page.waitForTimeout(800);

    const screenshotPath = `C:/Temp/caps_fillpermode_bc${bc}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });

    // --- Measure 1: Board card W ---
    // Try community-row-0 first child (a rendered card View/div).
    // Also measure via [data-testid="hand-card"] on the board side if available.
    // The most reliable: find all card-like elements in community-row-0 and take first non-zero w.
    const communityRow = page.locator('[data-testid="community-row-0"]');
    const boardCardW = await communityRow.evaluate((el) => {
      // Walk all descendant elements looking for one with a card-like portrait aspect ratio
      const all = Array.from(el.querySelectorAll('*'));
      for (const child of all) {
        const r = child.getBoundingClientRect();
        if (r.width > 20 && r.height > r.width) {
          return Math.round(r.width);
        }
      }
      // Fallback: first direct child
      const card = el.children[0];
      if (!card) return -1;
      return Math.round(card.getBoundingClientRect().width);
    });

    // --- Measure 2: Hand card W ---
    const handCard = page.locator('[data-testid="hand-card"]').first();
    const handCardW = await handCard.evaluate((el) => {
      return Math.round(el.getBoundingClientRect().width);
    });

    // --- Measure 3: Dead gap = hand-zone top - board-last bottom ---
    // "board-last bottom" = the bottom edge of the last visible board card row
    // We use the lowest board's bounding box bottom
    const allBoardLocators = page.locator('[data-testid^="board-"]');
    const boardCount = await allBoardLocators.count();
    let boardsBottom = -1;
    for (let i = 0; i < boardCount; i++) {
      const box = await allBoardLocators.nth(i).boundingBox();
      if (box) {
        const bottom = box.y + box.height;
        if (bottom > boardsBottom) boardsBottom = bottom;
      }
    }

    // Hand zone top = top of the hand-row element (or first hand-card)
    const handRow = page.locator('[data-testid="hand-row"]').first();
    let handTop = -1;
    try {
      const box = await handRow.boundingBox();
      if (box) handTop = box.y;
    } catch (_) {
      const hcBox = await handCard.boundingBox();
      if (hcBox) handTop = hcBox.y;
    }

    // Positive gap = empty space; negative = hand zone starts inside boards container padding
    // Accept ≤10px absolute (padding between zones is fine)
    const deadGap = (boardsBottom >= 0 && handTop >= 0) ? Math.round(handTop - boardsBottom) : null;

    // --- Measure 4: Scroll state of boards-only ScrollView ---
    // Walk up from board-0 collecting ALL scrollable ancestors, pick the innermost one
    // that is NOT the document body (i.e. the boards ScrollView)
    const scrollInfo = await page.locator('[data-testid="board-0"]').evaluate((el) => {
      const candidates = [];
      let node = el.parentElement;
      while (node && node !== document.documentElement) {
        const style = window.getComputedStyle(node);
        const ov = style.overflow + ' ' + style.overflowY;
        if (ov.includes('scroll') || ov.includes('auto')) {
          const r = node.getBoundingClientRect();
          candidates.push({
            scrollHeight: node.scrollHeight,
            clientHeight: node.clientHeight,
            overflowY: style.overflowY,
            tag: node.tagName,
            h: Math.round(r.height),
            y: Math.round(r.top),
            isBody: node === document.body,
          });
        }
        node = node.parentElement;
      }
      // Return innermost non-body scroll container (first candidate), fall back to body
      const inner = candidates.find(c => !c.isBody) || candidates[0] || {
        scrollHeight: document.body.scrollHeight,
        clientHeight: document.body.clientHeight,
        overflowY: 'body',
        isBody: true,
      };
      return { inner, allCandidates: candidates };
    });

    // The boards ScrollView scrolls = its scrollHeight > clientHeight
    const boardsScrollContainer = scrollInfo.inner;
    const scrolls = boardsScrollContainer.scrollHeight > boardsScrollContainer.clientHeight + 5;

    // --- Measure 5 (bc=4): Y monotonic boards ---
    const boardTops = [];
    for (let i = 0; i < boardCount; i++) {
      const box = await allBoardLocators.nth(i).boundingBox();
      if (box) boardTops.push(box.y);
    }
    const yMonotonic = boardTops.every((v, i) => i === 0 || v >= boardTops[i - 1]);

    return {
      bc, numberOfPlayers,
      boardCardW, handCardW,
      deadGap,
      scrollInfo, scrolls,
      boardTops, yMonotonic,
      boardCount,
      screenshotPath,
      error: null,
    };

  } catch (err) {
    const screenshotPath = `C:/Temp/caps_fillpermode_bc${bc}.png`;
    try { await page.screenshot({ path: screenshotPath, fullPage: false }); } catch (_) {}
    return { bc, numberOfPlayers, error: err.message, screenshotPath };
  } finally {
    await ctx.close();
  }
}

(async () => {
  console.log('FILL-PER-MODE verifier');
  console.log(`URL: ${EXPO_URL} | Viewport: ${VIEWPORT.width}x${VIEWPORT.height}\n`);

  const browser = await chromium.launch({ headless: true });

  // bc=2 (4P), bc=3 (3P), bc=4 (2P)
  const MODES = [
    { bc: 2, numberOfPlayers: 4 },
    { bc: 3, numberOfPlayers: 3 },
    { bc: 4, numberOfPlayers: 2 },
  ];

  const results = [];
  for (const { bc, numberOfPlayers } of MODES) {
    process.stdout.write(`Measuring bc=${bc} (numberOfPlayers=${numberOfPlayers})... `);
    const r = await measureMode(browser, bc, numberOfPlayers);
    results.push(r);
    if (r.error) {
      console.log(`ERROR: ${r.error}`);
    } else {
      console.log(`boardCardW=${r.boardCardW} handCardW=${r.handCardW} gap=${r.deadGap} scrolls=${r.scrolls}`);
    }
  }

  await browser.close();

  console.log('\n====== FILL-PER-MODE REPORT @ width=393 ======\n');

  let allPass = true;

  for (const r of results) {
    if (r.error) {
      console.log(`bc=${r.bc}: ERROR — ${r.error}`);
      allPass = false;
      continue;
    }

    const checks = [];
    let rowPass = true;

    // 1. W: board card == hand card (±1pt)
    const wMatch = r.boardCardW >= 0 && r.handCardW >= 0 && Math.abs(r.boardCardW - r.handCardW) <= 1;
    checks.push(`boardW=${r.boardCardW} handW=${r.handCardW} match=${wMatch ? 'OK' : 'FAIL'}`);
    if (!wMatch) rowPass = false;

    // 2. Dead gap ≤ 10px
    const gapOk = r.deadGap !== null && Math.abs(r.deadGap) <= 10;
    checks.push(`gap=${r.deadGap ?? '?'}px ${gapOk ? 'OK' : 'FAIL'}`);
    if (!gapOk) rowPass = false;

    // 3. Scroll state: only bc=4 scrolls
    const expectedScroll = r.bc === 4;
    const scrollOk = r.scrolls === expectedScroll;
    checks.push(`scroll=${r.scrolls} ${scrollOk ? 'OK' : `FAIL(want ${expectedScroll})`}`);
    if (!scrollOk) rowPass = false;

    // 4. bc=4 Y monotonic
    if (r.bc === 4) {
      checks.push(`yMono=${r.yMonotonic ? 'OK' : 'FAIL'} tops=[${r.boardTops.map(v => v.toFixed(0)).join(',')}]`);
      checks.push(`scrollH=${r.scrollInfo.scrollHeight} clientH=${r.scrollInfo.clientHeight}`);
      if (!r.yMonotonic) rowPass = false;
    }

    if (!rowPass) allPass = false;
    console.log(`bc=${r.bc} (${r.boardCount} boards): ${checks.join(', ')} => ${rowPass ? 'PASS' : 'FAIL'}`);
  }

  // W ordering across modes
  const r2 = results.find(r => r.bc === 2 && !r.error);
  const r3 = results.find(r => r.bc === 3 && !r.error);
  const r4 = results.find(r => r.bc === 4 && !r.error);

  if (r2 && r3 && r4) {
    const orderOk = r2.boardCardW > r3.boardCardW && r3.boardCardW > r4.boardCardW;
    console.log(`\nW ordering: ${r2.boardCardW} > ${r3.boardCardW} > ${r4.boardCardW} => ${orderOk ? 'PASS' : 'FAIL'}`);
    if (!orderOk) allPass = false;

    // bc=4 expected floor(55) ≈ 55pt
    const bc4w = r4.boardCardW;
    const bc4ok = bc4w !== null && Math.abs(bc4w - 55) <= 3;
    console.log(`bc=4 W expected≈55: got ${bc4w} => ${bc4ok ? 'PASS' : `FAIL (delta=${Math.abs(bc4w - 55)})`}`);
    if (!bc4ok) allPass = false;
  }

  console.log(`\nScreenshots: C:/Temp/caps_fillpermode_bc{2,3,4}.png`);
  console.log(`\nOVERALL: ${allPass ? 'PASS' : 'FAIL'}`);
  process.exit(allPass ? 0 : 1);
})();
