/**
 * THE ARRANGEMENT CLOCK IS LONGER ONLY WHERE THE BOARDS ZONE ACTUALLY OVERFLOWS.
 *
 * TIMER-NOT-LAYOUT 2026-09-08 — Roye's option 3: the problem was never the scroll, it is scrolling
 * under a clock. These cases use the REAL measured heights from both engines
 * (docs/reporter-and-board4/board-fit-*.json), so if the derivation is ever retuned the numbers it
 * produces for the cells we actually shipped stay visible in the diff.
 */
import { ARRANGE_CLOCK, getArrangeSeconds } from '../gameConfig';

const BASE = ARRANGE_CLOCK.baseSeconds;

// viewport / content as MEASURED on the built app, chromium and webkit agreeing to 1px.
const CELLS = {
  '320-2P': { boardsScroll: true,  boardsAvailH: 206, boardsContentH: 477 },  // 271px hidden
  '320-3P': { boardsScroll: true,  boardsAvailH: 254, boardsContentH: 367 },  // 113px hidden
  '393-2P': { boardsScroll: true,  boardsAvailH: 512, boardsContentH: 556 },  //  44px hidden
  '320-4P': { boardsScroll: false, boardsAvailH: 254, boardsContentH: 254 },  // fits
  '393-3P': { boardsScroll: false, boardsAvailH: 512, boardsContentH: 500 },  // fits
  '393-4P': { boardsScroll: false, boardsAvailH: 512, boardsContentH: 420 },  // fits
};

describe('getArrangeSeconds', () => {
  it('gives the base clock wherever the boards fit — all three non-overflowing cells', () => {
    for (const key of ['320-4P', '393-3P', '393-4P'] as const) {
      expect([key, getArrangeSeconds(CELLS[key])]).toEqual([key, BASE]);
    }
  });

  it('gives MORE than base in exactly the three overflowing cells', () => {
    for (const key of ['320-2P', '320-3P', '393-2P'] as const) {
      expect([key, getArrangeSeconds(CELLS[key]) > BASE]).toEqual([key, true]);
    }
  });

  it('scales by how much of the stack is off screen, not by a flat bump', () => {
    // 320-2P hides 57% of its boards and gets the most; 393-2P hides 8% and gets the least.
    const a = getArrangeSeconds(CELLS['320-2P']);
    const b = getArrangeSeconds(CELLS['320-3P']);
    const c = getArrangeSeconds(CELLS['393-2P']);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
    expect([a, b, c]).toEqual([70, 44, 33]);   // ceil(30 * 477/206 | 367/254 | 556/512)
  });

  it('never shortens the clock — a ratio below 1 cannot make the hand harder', () => {
    expect(getArrangeSeconds({ boardsScroll: true, boardsAvailH: 500, boardsContentH: 100 })).toBe(BASE);
  });

  it('ignores boardsScroll=false even if the heights say otherwise — one source of truth', () => {
    expect(getArrangeSeconds({ boardsScroll: false, boardsAvailH: 100, boardsContentH: 900 })).toBe(BASE);
  });

  it('caps a pathological layout, and the cap does NOT bite anything measured today', () => {
    const worst = CELLS['320-2P'].boardsContentH / CELLS['320-2P'].boardsAvailH;   // 2.316
    expect(worst).toBeLessThan(ARRANGE_CLOCK.maxScrollMultiplier);
    expect(getArrangeSeconds({ boardsScroll: true, boardsAvailH: 10, boardsContentH: 9999 }))
      .toBe(Math.ceil(BASE * ARRANGE_CLOCK.maxScrollMultiplier));
  });

  it('survives a zero or nonsense available height rather than minting Infinity', () => {
    expect(getArrangeSeconds({ boardsScroll: true, boardsAvailH: 0, boardsContentH: 400 })).toBe(BASE);
    expect(getArrangeSeconds({ boardsScroll: true, boardsAvailH: -5, boardsContentH: 400 })).toBe(BASE);
  });
});
