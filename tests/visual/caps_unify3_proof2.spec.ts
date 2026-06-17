import { test, expect } from '@playwright/test';

const EXPO_URL = 'http://localhost:8082';

const STORAGE: Record<string, string> = {
  caps_tutorial_seen: 'true',
  caps_onboarding_done: 'true',
  has_seen_interactive_tutorial: 'true',
  caps_language: 'he',
  caps_games_played: '99',
};

function pokerStorage(numberOfPlayers: number) {
  // Zustand persist shape: state.config.numberOfPlayers (not state.numberOfPlayers)
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

async function setupPage(page: any, numberOfPlayers: number) {
  await page.route('**/*.bundle*', async (route: any) => {
    const resp = await route.fetch();
    let body = await resp.text();
    body = body.replace(/import\.meta\.env/g, '({})');
    body = body.replace(/import\.meta/g, '({})');
    await route.fulfill({ response: resp, body });
  });

  await page.addInitScript((args: { storage: Record<string, string>; poker: string }) => {
    for (const [k, v] of Object.entries(args.storage)) {
      localStorage.setItem(k, v);
    }
    localStorage.setItem('caps-poker-storage', args.poker);
  }, { storage: STORAGE, poker: pokerStorage(numberOfPlayers) });

  await page.setViewportSize({ width: 393, height: 852 });
  // Seed storage on the root first, then navigate to /game
  await page.goto(EXPO_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Re-seed after page load (addInitScript runs before load, but Expo may re-init storage)
  await page.evaluate((args: { storage: Record<string, string>; poker: string }) => {
    for (const [k, v] of Object.entries(args.storage)) {
      localStorage.setItem(k, v);
    }
    localStorage.setItem('caps-poker-storage', args.poker);
  }, { storage: STORAGE, poker: pokerStorage(numberOfPlayers) });
  // Navigate directly to /game — Expo Router serves it at 200
  await page.goto(`${EXPO_URL}/game`, { waitUntil: 'networkidle', timeout: 30000 });
}

// Map numberOfPlayers → boardCount: 4P=2, 3P=3, 2P=4
const CASES = [
  { numberOfPlayers: 4, bc: 2, expectedRows: 2 },
  { numberOfPlayers: 3, bc: 3, expectedRows: 2 },
  { numberOfPlayers: 2, bc: 4, expectedRows: 3 },
];

for (const { numberOfPlayers, bc, expectedRows } of CASES) {
  test(`bc=${bc} — unified card size 4 proofs`, async ({ page }) => {
    await setupPage(page, numberOfPlayers);

    // Navigate to game — try /game route or look for board elements
    // Wait for board to be visible
    await page.waitForSelector('[data-testid="board-0"]', { timeout: 15000 });

    await page.screenshot({ path: `C:/Temp/caps_unify3_bc${bc}_initial.png` });

    // --- PROOF 1: Board card W == Hand card W (±1pt) ---
    // Measure community card (first card in community row 0)
    const communityRow = page.locator('[data-testid="community-row-0"]');
    await expect(communityRow).toBeVisible({ timeout: 5000 });

    // Get board card dimensions from first child of community row
    const boardCardW = await communityRow.evaluate((el: HTMLElement) => {
      const card = el.children[0] as HTMLElement;
      if (!card) return -1;
      return card.getBoundingClientRect().width;
    });

    // Measure hand card width
    const handCard = page.locator('[data-testid="hand-card"]').first();
    await expect(handCard).toBeVisible({ timeout: 5000 });
    const handCardW = await handCard.evaluate((el: HTMLElement) => {
      return el.getBoundingClientRect().width;
    });

    const proof1Pass = Math.abs(boardCardW - handCardW) <= 1;
    console.log(`bc=${bc} P1: boardCardW=${boardCardW.toFixed(1)} handCardW=${handCardW.toFixed(1)} diff=${Math.abs(boardCardW-handCardW).toFixed(1)} ${proof1Pass?'PASS':'FAIL'}`);

    // --- PROOF 2: Hand row count ---
    // hand-row is a single flex-wrap View; count visual rows by distinct Y bands of hand-card children
    const handDiag = await page.locator('[data-testid="hand-row"]').evaluate((el: HTMLElement) => {
      const cards = Array.from(el.querySelectorAll('[data-testid="hand-card"]'));
      const tops = cards.map(c => Math.round(c.getBoundingClientRect().top));
      const unique = [...new Set(tops)].sort((a, b) => a - b);
      const ds = (el as any).dataset || {};
      return {
        rows: unique.length,
        cardCount: cards.length,
        tops: unique,
        cardw: ds.cardw,
        roww: ds.roww,
        gridouter: ds.gridouter,
        screenw: ds.screenw,
      };
    });
    const handRows = handDiag.rows;
    const proof2Pass = handRows === expectedRows;
    console.log(`bc=${bc} P2: handRows=${handRows} expected=${expectedRows} cardCount=${handDiag.cardCount} tops=[${handDiag.tops}] cardw=${handDiag.cardw} roww=${handDiag.roww} gridouter=${handDiag.gridouter} screenw=${handDiag.screenw} ${proof2Pass?'PASS':'FAIL'}`);

    // --- PROOF 3: Boards zone H > Hand zone H ---
    // Find boards container and hand container heights
    const boardZone = page.locator('[data-testid="board-0"]').first();
    const boardZoneH = await boardZone.evaluate((el: HTMLElement) => {
      // Walk up to find the boards container
      let node: HTMLElement | null = el;
      while (node && node.parentElement) {
        if (node.parentElement.querySelectorAll('[data-testid^="board-"]').length > 1) {
          return node.parentElement.getBoundingClientRect().height;
        }
        node = node.parentElement;
      }
      return el.getBoundingClientRect().height;
    });

    const handContainer = page.locator('[data-testid="hand-row"]').first();
    const handContainerH = await handContainer.evaluate((el: HTMLElement) => {
      // Get the hand zone container
      let node: HTMLElement | null = el;
      while (node && node.parentElement) {
        // Look for a parent that contains all hand rows
        if (node.parentElement.querySelectorAll('[data-testid="hand-row"]').length > 1 ||
            node.parentElement.getAttribute('data-testid') === 'hand-zone') {
          return node.parentElement.getBoundingClientRect().height;
        }
        node = node.parentElement;
      }
      return el.getBoundingClientRect().height;
    });

    // Alternative: use slot-row-0 as the boards area parent
    const slotsZoneH = await page.locator('[data-testid="slot-row-0"]').first().evaluate((el: HTMLElement) => {
      let node: HTMLElement | null = el;
      for (let i = 0; i < 4; i++) {
        if (!node?.parentElement) break;
        node = node.parentElement;
      }
      return node ? node.getBoundingClientRect().height : -1;
    });

    const proof3Pass = boardZoneH > handContainerH;
    console.log(`bc=${bc} P3: boardZoneH=${boardZoneH.toFixed(1)} handContainerH=${handContainerH.toFixed(1)} slotsZoneH=${slotsZoneH.toFixed(1)} ${proof3Pass?'PASS':'FAIL'}`);

    // --- PROOF 4: bc=4 boards scroll (only check when bc=4) ---
    let proof4Pass = true;
    let proof4Note = 'N/A (bc!=4)';
    if (bc === 4) {
      // Find the scrollable boards container
      const scrollInfo = await page.locator('[data-testid="board-0"]').evaluate((el: HTMLElement) => {
        let node: HTMLElement | null = el;
        while (node && node.parentElement) {
          const style = window.getComputedStyle(node);
          const overflow = style.overflow + style.overflowY;
          if (overflow.includes('scroll') || overflow.includes('auto')) {
            return {
              scrollHeight: node.scrollHeight,
              clientHeight: node.clientHeight,
              overflowY: style.overflowY,
            };
          }
          node = node.parentElement;
        }
        return { scrollHeight: -1, clientHeight: -1, overflowY: 'none' };
      });

      // Check Y monotonic across boards
      const boards = await page.locator('[data-testid^="board-"]').all();
      const boardTops: number[] = [];
      for (const b of boards) {
        const box = await b.boundingBox();
        if (box) boardTops.push(box.y);
      }
      const yMonotonic = boardTops.every((v, i) => i === 0 || v >= boardTops[i - 1]);

      proof4Pass = scrollInfo.scrollHeight > scrollInfo.clientHeight && yMonotonic;
      proof4Note = `scrollH=${scrollInfo.scrollHeight} clientH=${scrollInfo.clientHeight} yMono=${yMonotonic} boardTops=[${boardTops.map(v=>v.toFixed(0)).join(',')}]`;
      console.log(`bc=${bc} P4: ${proof4Note} ${proof4Pass?'PASS':'FAIL'}`);
    } else {
      console.log(`bc=${bc} P4: ${proof4Note}`);
    }

    await page.screenshot({ path: `C:/Temp/caps_unify3_bc${bc}.png`, fullPage: false });

    // Final assertions
    expect(proof1Pass, `P1 boardCardW=${boardCardW.toFixed(1)} handCardW=${handCardW.toFixed(1)}`).toBe(true);
    expect(proof2Pass, `P2 handRows=${handRows} expected=${expectedRows}`).toBe(true);
    expect(proof3Pass, `P3 boardZoneH=${boardZoneH.toFixed(1)} handContainerH=${handContainerH.toFixed(1)}`).toBe(true);
    if (bc === 4) {
      expect(proof4Pass, `P4: ${proof4Note}`).toBe(true);
    }
  });
}
