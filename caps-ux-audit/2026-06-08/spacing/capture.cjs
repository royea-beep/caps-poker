'use strict';
const { chromium } = require('C:/Projects/POKER/Caps/node_modules/playwright/index.js');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8765';
const OUT_DIR = 'C:/Projects/POKER/Caps/caps-ux-audit/2026-06-08/spacing';

const GS = JSON.stringify({
  state: {
    chips: 1200,
    bestChips: 1200,
    config: {
      numberOfPlayers: 2,
      potPerBoard: 25,
      arrangementTime: 60,
      boardRevealDuration: 5,
      turnRevealDelay: 800,
      completeBonusDisplay: 3,
      startingChips: 1000,
      completeBonusPercent: 50,
      botSpeedMin: 1500,
      botSpeedMax: 4000,
      soundEnabled: false,
      soundVolume: 0,
      revealSpeed: 'normal',
      botDifficulty: 'easy',
    },
    handsPlayed: 99,
    handsWon: 60,
    biggestWin: 75,
    playerName: 'Player',
    playerAvatar: 'P',
    notificationsEnabled: false,
    cardTheme: 'v1',
    homeTheme: 'dark_gold',
    buttonStyle: 'solid',
    friendsBg: 'none',
    fourColorSuits: false,
    colorblindMode: false,
    handSortMethod: 'caps',
    orientation: 'portrait',
    visualTheme: 'classic',
    lastDailyRewardClaim: null,
    dailyRewardStreak: 0,
    lastFreeRefill: null,
    totalChipsEarned: 200,
    totalChipsSpent: 100,
    unlockedAchievements: [],
    currentWinStreak: 2,
    bestWinStreak: 3,
  },
  version: 0,
});

async function mkPage(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: false,
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push('pageerror:' + e.message.slice(0, 200)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push('consoleerror:' + msg.text().slice(0, 200));
  });
  await page.addInitScript((gs) => {
    localStorage.setItem('caps_language', 'en');
    localStorage.setItem('caps-poker-storage', gs);
    localStorage.setItem('caps_games_played', '99');
    localStorage.setItem('guidedModeForced', 'false');
    localStorage.setItem('caps_tutorial_seen', 'true');
    localStorage.setItem('has_seen_interactive_tutorial', 'true');
    localStorage.setItem('caps_daily_reward_popup_shown', '1');
    const d = new Date();
    localStorage.setItem('recap_week', 'recap_' + d.getFullYear() + '_' + Math.ceil(d.getDate() / 7));
  }, GS);
  return { ctx, page, consoleErrors };
}

// Measure board zone & hand zone DOM rects.
async function measure(page) {
  return page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const W = window.innerWidth;
    const H = window.innerHeight;
    // Action bar: find ONLY leaf text nodes (no children) exactly matching the action button labels.
    // Walk up at most 4 ancestors, picking the wrapper that is NOT full-screen (width < W and height < 200).
    const wantText = new Set(['cancel', 'confirm', 'ready']);
    let actionBarTop = null;
    let actionBarRect = null;
    for (const el of all) {
      if (el.children.length !== 0) continue;
      const txt = (el.textContent || '').trim().toLowerCase();
      if (!wantText.has(txt) && !txt.startsWith('ready (')) continue;
      let cur = el;
      for (let i = 0; i < 5 && cur; i++) {
        const r = cur.getBoundingClientRect();
        if (
          r.top > H * 0.7 &&
          r.bottom <= H + 2 &&
          r.height < 200 &&
          r.height > 30 &&
          r.width < W - 1 &&
          r.width > 40
        ) {
          if (actionBarTop === null || r.top < actionBarTop) {
            actionBarTop = r.top;
            actionBarRect = { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
          }
          break;
        }
        cur = cur.parentElement;
      }
    }
    // Hand zone: cluster of cards (poker card aspect) near bottom but above action bar.
    const rects = all
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width >= 18 && r.width <= 80 && r.height >= 24 && r.height <= 100 && r.top > H * 0.4);
    // Find max card-like bottom.
    let handBottom = null;
    let handTop = null;
    let cardCount = 0;
    for (const { r } of rects) {
      const ratio = r.height / r.width;
      if (ratio > 1.1 && ratio < 1.9) {
        cardCount++;
        if (handBottom === null || r.bottom > handBottom) handBottom = r.bottom;
        if (handTop === null || r.top < handTop) handTop = r.top;
      }
    }
    // Restrict hand to those that sit BELOW boards. We'll use bottom-most bands of card-likes.
    const cardLikes = rects
      .filter(({ r }) => {
        const ratio = r.height / r.width;
        return ratio > 1.1 && ratio < 1.9;
      })
      .map(({ r }) => r);
    cardLikes.sort((a, b) => a.top - b.top);
    // Find "hand" cluster = those whose top is closest to bottom of viewport.
    let handCluster = [];
    if (cardLikes.length > 0) {
      const lastBottom = Math.max(...cardLikes.map((r) => r.bottom));
      // Find cards within ~280px above lastBottom (4 rows × ~60px = 240).
      handCluster = cardLikes.filter((r) => lastBottom - r.bottom < 290);
    }
    let handZone = null;
    if (handCluster.length) {
      handZone = {
        top: Math.min(...handCluster.map((r) => r.top)),
        bottom: Math.max(...handCluster.map((r) => r.bottom)),
        count: handCluster.length,
      };
    }
    // Boards: the cards above handZone (if known).
    let boardCluster = [];
    if (handZone) {
      boardCluster = cardLikes.filter((r) => r.bottom <= handZone.top + 2);
    } else {
      boardCluster = cardLikes;
    }
    // Group boards into 4 by row clustering using top y.
    const boardRows = [];
    if (boardCluster.length) {
      const sorted = [...boardCluster].sort((a, b) => a.top - b.top);
      const rows = [];
      const TH = 40;
      for (const r of sorted) {
        const last = rows[rows.length - 1];
        if (!last || r.top - last[0].top > TH) rows.push([r]);
        else last.push(r);
      }
      // For 2-player 4-board 2x2 grid, expect 4 boards. Each board has 2 player rows of 4 = 8 card slots,
      // arranged in a 2x2 grid. Group by row+column quadrants.
      // Compute board bboxes by clustering.
      const W2 = W / 2;
      const MID_Y = (Math.min(...boardCluster.map((r) => r.top)) + Math.max(...boardCluster.map((r) => r.bottom))) / 2;
      const quads = { tl: [], tr: [], bl: [], br: [] };
      for (const r of boardCluster) {
        const cx = (r.left + r.right) / 2;
        const cy = (r.top + r.bottom) / 2;
        const q = (cy < MID_Y ? 't' : 'b') + (cx < W2 ? 'l' : 'r');
        quads[q].push(r);
      }
      for (const k of Object.keys(quads)) {
        const list = quads[k];
        if (list.length === 0) continue;
        boardRows.push({
          quadrant: k,
          top: Math.min(...list.map((r) => r.top)),
          bottom: Math.max(...list.map((r) => r.bottom)),
          left: Math.min(...list.map((r) => r.left)),
          right: Math.max(...list.map((r) => r.right)),
          count: list.length,
        });
      }
    }
    return {
      viewport: { W, H },
      actionBarTop,
      actionBarRect,
      handZone,
      cardLikes: cardLikes.length,
      boardRows,
      handBottomRaw: handBottom,
      handTopRaw: handTop,
      cardLikeCountAll: cardCount,
    };
  });
}

async function findHandCards(page) {
  // Return array of card-like rects sorted by y then x, filtered to hand area.
  return page.evaluate(() => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const all = Array.from(document.querySelectorAll('*'));
    const cards = [];
    for (const el of all) {
      const r = el.getBoundingClientRect();
      if (r.width < 22 || r.width > 80) continue;
      if (r.height < 28 || r.height > 100) continue;
      const ratio = r.height / r.width;
      if (ratio < 1.1 || ratio > 1.9) continue;
      if (r.top < H * 0.55) continue; // hand area only
      // Walk up to find pressable / role=button
      let pressable = el;
      let depth = 0;
      while (pressable && depth < 6) {
        if (pressable.getAttribute && (pressable.getAttribute('role') === 'button' || pressable.tagName === 'BUTTON')) break;
        pressable = pressable.parentElement;
        depth++;
      }
      cards.push({
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
        top: r.top,
        bottom: r.bottom,
        left: r.left,
        right: r.right,
      });
    }
    cards.sort((a, b) => (a.top - b.top) || (a.left - b.left));
    return cards;
  });
}

async function tapCardByIndex(page, idx) {
  // Click hand card by sorted index
  const cards = await findHandCards(page);
  if (idx >= cards.length) return false;
  const c = cards[idx];
  await page.mouse.click(c.x, c.y);
  return true;
}

async function findBoardCenters(page) {
  return page.evaluate(() => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    // Find hand bottom band — biggest card-like cluster nearest viewport bottom.
    const all = Array.from(document.querySelectorAll('*'));
    const cardLikes = [];
    for (const el of all) {
      const r = el.getBoundingClientRect();
      if (r.width < 22 || r.width > 80) continue;
      if (r.height < 28 || r.height > 100) continue;
      const ratio = r.height / r.width;
      if (ratio < 1.1 || ratio > 1.9) continue;
      cardLikes.push({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
    }
    if (!cardLikes.length) return [];
    // Hand cluster: cards near bottom (lowermost 290px band).
    const lastBottom = Math.max(...cardLikes.map((r) => r.bottom));
    const hand = cardLikes.filter((r) => lastBottom - r.bottom < 290 && r.top > H * 0.5);
    const handTop = hand.length ? Math.min(...hand.map((r) => r.top)) : H;
    // Boards = cards above handTop.
    const boards = cardLikes.filter((r) => r.bottom <= handTop - 2);
    if (!boards.length) return [];
    const W2 = W / 2;
    const minTop = Math.min(...boards.map((r) => r.top));
    const maxBot = Math.max(...boards.map((r) => r.bottom));
    const MID_Y = (minTop + maxBot) / 2;
    const quads = { tl: [], tr: [], bl: [], br: [] };
    for (const r of boards) {
      const cx = (r.left + r.right) / 2;
      const cy = (r.top + r.bottom) / 2;
      const q = (cy < MID_Y ? 't' : 'b') + (cx < W2 ? 'l' : 'r');
      quads[q].push(r);
    }
    const out = [];
    for (const k of ['tl', 'tr', 'bl', 'br']) {
      const list = quads[k];
      if (!list.length) continue;
      const top = Math.min(...list.map((r) => r.top));
      const bottom = Math.max(...list.map((r) => r.bottom));
      const left = Math.min(...list.map((r) => r.left));
      const right = Math.max(...list.map((r) => r.right));
      // Target click point: choose an empty area = middle-right of quadrant where empty slots live.
      // Use the right-edge x area at bottom-row y of the board (since boards have a 2-row layout
      // and player drops to bottom row, click on right side of bottom row).
      const midRowY = (top + bottom) / 2;
      const bottomRowY = bottom - (bottom - top) * 0.15;
      out.push({
        quadrant: k,
        cx: (left + right) / 2,
        cy: (top + bottom) / 2,
        bottomRowY,
        rightSlotX: right - 20,
        top,
        bottom,
        left,
        right,
        cardCount: list.length,
      });
    }
    return out;
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const { ctx, page, consoleErrors } = await mkPage(browser);

  await page.goto(BASE_URL + '/game', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(4000);

  // Dismiss any guided modal by pressing Escape and tapping "Got it" if present.
  try {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
  } catch {}

  // ====== PLACEMENT capture (16-card hand guard, no placements) ======
  // Wait for hand to be present
  await page.waitForTimeout(2500);
  const placementMeasure = await measure(page);
  // Find hand card count for "16-card guard"
  const handCardsInitial = await findHandCards(page);
  fs.writeFileSync(
    path.join(OUT_DIR, 'placement_measure.json'),
    JSON.stringify({ placementMeasure, handCount: handCardsInitial.length, consoleErrors: consoleErrors.slice(0, 10) }, null, 2)
  );
  await page.screenshot({ path: path.join(OUT_DIR, '4board-placement.png'), fullPage: false });

  // ====== READY capture: auto-place all 16 ======
  // For 2-player game, hand has 16 cards. We distribute 4-per-board into 4 boards via tap.
  // Algorithm: get fresh hand card list each pass, tap card 0, then tap board center round-robin.
  const boards = await findBoardCenters(page);
  if (boards.length !== 4) {
    fs.appendFileSync(
      path.join(OUT_DIR, 'placement_measure.json'),
      '\n# WARN: detected ' + boards.length + ' boards (expected 4)\n'
    );
  }
  // Auto-place via per-board Auto-Place pills. Each click fills 4 slots on one board.
  // Strategy: scan for visible "Auto-Place" elements and click each.
  let placedTotal = 0;
  for (let pass = 0; pass < 6; pass++) {
    const autoPills = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const out = [];
      for (const el of all) {
        if (el.children.length > 2) continue;
        const txt = (el.textContent || '').trim();
        if (txt !== 'Auto-Place' && txt !== '⚡ Auto-Place' && !/Auto-Place/i.test(txt)) continue;
        if (txt.length > 20) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 20 || r.height < 12) continue;
        if (r.top < 0 || r.bottom > window.innerHeight) continue;
        out.push({ x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top });
      }
      // Dedupe by ~position
      const seen = new Set();
      const dedup = [];
      for (const p of out) {
        const k = Math.round(p.x / 10) + ':' + Math.round(p.y / 10);
        if (seen.has(k)) continue;
        seen.add(k);
        dedup.push(p);
      }
      dedup.sort((a, b) => a.top - b.top || a.x - b.x);
      return dedup;
    });
    if (autoPills.length === 0) break;
    for (const p of autoPills) {
      await page.mouse.click(p.x, p.y);
      await page.waitForTimeout(700);
      placedTotal += 4;
    }
    await page.waitForTimeout(700);
  }
  // Manual fallback fill: tap each remaining hand card then any empty board slot.
  for (let fbi = 0; fbi < 48; fbi++) {
    const hand = await findHandCards(page);
    if (hand.length === 0) break;
    // Locate empty slots: rectangles in board area with NO card content (use placeholder slot detection)
    const slot = await page.evaluate(() => {
      const H = window.innerHeight;
      const all = Array.from(document.querySelectorAll('*'));
      // Empty slot looks like a card-sized rect in boards area with no inner img/text (no rank/suit characters)
      const candidates = [];
      for (const el of all) {
        const r = el.getBoundingClientRect();
        if (r.width < 26 || r.width > 70) continue;
        if (r.height < 32 || r.height > 95) continue;
        const ratio = r.height / r.width;
        if (ratio < 1.1 || ratio > 1.9) continue;
        if (r.top > H * 0.55) continue;
        // Skip if contains a rank text (A K Q J T 10 9-2 or suit unicode)
        const txt = (el.textContent || '').trim();
        if (/[2-9TJQKA]|10|♠|♥|♦|♣/.test(txt)) continue;
        // Skip if any child <img>
        if (el.querySelector && el.querySelector('img')) continue;
        candidates.push({ x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, left: r.left });
      }
      candidates.sort((a, b) => a.top - b.top || a.left - b.left);
      return candidates[0] || null;
    });
    if (!slot) break;
    // Tap first hand card then the empty slot
    await page.mouse.click(hand[0].x, hand[0].y);
    await page.waitForTimeout(180);
    await page.mouse.click(slot.x, slot.y);
    await page.waitForTimeout(220);
    placedTotal++;
  }
  await page.waitForTimeout(800);
  const readyMeasure = await measure(page);
  const handAfter = await findHandCards(page);
  const boardsAfter = await findBoardCenters(page);
  await page.screenshot({ path: path.join(OUT_DIR, '4board-ready.png'), fullPage: false });

  fs.writeFileSync(
    path.join(OUT_DIR, 'ready_measure.json'),
    JSON.stringify(
      { readyMeasure, placedTotal, handLeft: handAfter.length, boardsAfter, consoleErrors: consoleErrors.slice(0, 20) },
      null,
      2
    )
  );

  await ctx.close();
  await browser.close();
  console.log('DONE');
}

main().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
