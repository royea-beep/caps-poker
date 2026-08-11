/**
 * MEASUREMENT, not an assertion suite: how often does `dead.length >= 8`?
 *
 * That is the state where the outs row shows EIGHT struck-through dead cards and ZERO live
 * outs, while the headline still reads "14 OUTS" and the chip reads "+14". The arithmetic is
 * self-consistent (OutsRow.tsx:60-63 slices dead FIRST, so room can reach 0), but a player
 * reads the eight cards as eight of the fourteen when they are the opposite.
 *
 * Sampled through `computeOuts` directly — it is a pure function, so hundreds of deals cost
 * nothing and resolve the distribution far better than 15 browser runs could. Run under jest
 * because tsx cannot transform react-native's Flow-typed entry, which deck.ts pulls in.
 *
 * `dead` is only non-empty when `previousOuts` is supplied, so each board contributes one
 * turn-stage sample: outs at the flop, then outs at the turn given the flop's outs.
 *
 *   npx jest outsDistribution --silent=false
 */
import { dealCardsMultiplayer } from '../deck';
import { computeOuts } from '../revealEquity';

const HANDS = Number(process.env.HANDS || 200);

describe('outs row — dead.length distribution (measurement)', () => {
  it('reports how often dead fills all 8 slots', () => {
    const buckets = { '0-3': 0, '4-7': 0, '8+': 0 };
    const perCount: Record<string, { n: number; ge8: number }> = {};
    let samples = 0, deadTotal = 0, maxDead = 0;

    for (const players of [2, 3, 4] as const) {
      const key = `${players}P`;
      perCount[key] = { n: 0, ge8: 0 };
      for (let h = 0; h < HANDS; h++) {
        const deal: any = dealCardsMultiplayer(players);
        const boards: any[] = deal.boards ?? [];
        const hands: any[] = deal.playerHands ?? deal.hands ?? [];
        if (!boards.length || !hands.length) continue;

        for (let b = 0; b < boards.length; b++) {
          // MultiDealResult.boards is `{ openCards, closedCards }` (deck.ts:28-32) — the flop is
          // `openCards`, turn+river are `closedCards`. My first pass looked for `community`/
          // `cards`, found neither, and silently produced ZERO samples. A shape assumption that
          // yields no data reads exactly like "nothing to report", which is why the test asserts
          // samples > 0 rather than trusting an empty distribution.
          const raw = boards[b];
          const community: any[] = [...(raw?.openCards ?? []), ...(raw?.closedCards ?? [])];
          if (community.length < 5) continue;

          // 4 cards PER BOARD per player — slice this board's four for every seat.
          const seats = hands.map((h: any) => {
            const cards: any[] = h?.cards ?? h;
            return Array.isArray(cards) ? cards.slice(b * 4, b * 4 + 4) : [];
          });
          const me = seats[0];
          const bots = seats.slice(1).filter((s) => s.length >= 2);
          if (!me || me.length < 4 || !bots.length) continue;

          const atFlop = computeOuts(me, bots, community.slice(0, 3));
          const atTurn = computeOuts(me, bots, community.slice(0, 4), atFlop.outs);

          samples++;
          perCount[key].n++;
          const d = atTurn.dead.length;
          deadTotal += d;
          if (d > maxDead) maxDead = d;
          if (d <= 3) buckets['0-3']++;
          else if (d <= 7) buckets['4-7']++;
          else { buckets['8+']++; perCount[key].ge8++; }
        }
      }
    }

    const pct = (n: number) => ((n / Math.max(1, samples)) * 100).toFixed(1) + '%';
    // eslint-disable-next-line no-console
    console.log(`\nsamples: ${samples} turn-stage boards (${HANDS} hands x 2P/3P/4P)`);
    console.log(`  dead 0-3 : ${buckets['0-3']}  ${pct(buckets['0-3'])}`);
    console.log(`  dead 4-7 : ${buckets['4-7']}  ${pct(buckets['4-7'])}`);
    console.log(`  dead 8+  : ${buckets['8+']}  ${pct(buckets['8+'])}   <<< no live outs shown`);
    console.log(`  mean dead ${(deadTotal / Math.max(1, samples)).toFixed(2)} | max ${maxDead}`);
    for (const [k, v] of Object.entries(perCount)) {
      console.log(`  ${k}: ${v.n} samples, ${v.ge8} with dead>=8 (${((v.ge8 / Math.max(1, v.n)) * 100).toFixed(1)}%)`);
    }
    expect(samples).toBeGreaterThan(0);
  });
});
