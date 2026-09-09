/**
 * SINK CANDIDATES, MODELLED — not guessed.
 *
 * Every input below is a MEASURED value from this database or from the shipped code, cited on the
 * line that uses it. Nothing here is shipped; this produces the numbers Roye decides from.
 *
 *   node tools/sink-model.mjs
 */

// ── MEASURED INPUTS ─────────────────────────────────────────────────────────────────────────
const FLOAT_TODAY   = 1_219_217;   // sum(leaderboard.total_chips), 2026-08-28
const LEDGER_TODAY  =   834_724;   // sum(chip_transactions.amount)
const POT_PER_BOARD = 25;          // constants/gameConfig.ts
const BOARDS        = { 2: 4, 3: 3, 4: 2 };   // dynamic — never hardcoded
const RAKE_PCT      = 5;           // app_config.hand_rake_pct — LIVE
// faucet, post PLAY-NOT-PRESENCE (app_config, 2026-08-28)
const PRESENCE_MULT = 0.4;
const PLAY_GRANT    = 80;
const PLAY_CAP      = 800;
// streak ladder base, before the multiplier (claim_daily_streak)
const streakBase = (d) => d >= 30 ? 10000 : d >= 14 ? 2500 : d >= 7 ? 1500 : d >= 5 ? 1000 : d >= 3 ? 750 : d >= 2 ? 600 : 500;
// daily_reward ladder (claim_daily_reward)
const rewardBase = (d) => {
  let c = d <= 7 ? 25 + d * 5 : d <= 14 ? 50 + d * 5 : d <= 21 ? 100 + d * 5 : 200 + d * 5;
  if (d === 7) c += 100; if (d === 14) c += 200; if (d === 21) c += 300; if (d === 30) c += 500;
  return c;
};

/** Chips a player RECEIVES on day d of an unbroken streak, at H hands per day. */
function faucetPerDay(d, hands) {
  const day = Math.min(d, 30);
  return Math.floor(streakBase(day) * PRESENCE_MULT) + rewardBase(day)
       + Math.min(hands * PLAY_GRANT, PLAY_CAP);
}

/**
 * Chips a player LOSES to the rake per day.
 * The buy-in is NOT a loss — it is zero-sum and returns to the winners. Only the rake leaves.
 * A player wins their share of boards on average, so gross winnings ≈ buy-in; the rake is taken
 * on the POSITIVE net only, which for an average player is the pot they take on boards they win.
 */
function rakePerDay(hands, players = 3, rakePct = RAKE_PCT) {
  const boards = BOARDS[players];
  const potPerBoardTotal = POT_PER_BOARD * players;      // what the winner of one board takes
  const boardsWonAvg = boards / players;                  // average share
  const grossWonPerHand = potPerBoardTotal * boardsWonAvg;
  return Math.floor(hands * grossWonPerHand * rakePct / 100);
}

const ARCHETYPES = [
  { name: 'opener  (0 hands/day)', hands: 0 },
  { name: 'casual  (3 hands/day)', hands: 3 },
  { name: 'regular (10 hands/day, at cap)', hands: 10 },
];

// ── THE CANDIDATES ──────────────────────────────────────────────────────────────────────────
// Each returns chips DESTROYED per player per week. "Destroyed" means removed from the float —
// not moved between players.
const CANDIDATES = [
  {
    id: 'A. rake at 5% (today)',
    built: 'yes — live, server-side, app_config.hand_rake_pct',
    punishesEngaged: true,
    weekly: (a) => 7 * rakePerDay(a.hands),
  },
  {
    id: 'B. rake at 15%',
    built: 'yes — one config value',
    punishesEngaged: true,
    weekly: (a) => 7 * rakePerDay(a.hands, 3, 15),
  },
  {
    id: 'C. tournament entry, 20% held back',
    built: 'PARTLY — SnG exists but pays out 100% of the pool (see doc). Needs a rake on the pool.',
    punishesEngaged: false,
    // one tournament per active day, 100 entry, 20% of the pool retired
    weekly: (a) => (a.hands === 0 ? 0 : 7 * Math.floor(100 * 0.20)),
  },
  {
    id: 'D. cosmetics, catalogue as it stands',
    built: 'yes — 4 permanent items, 1,150 chips TOTAL, then never again',
    punishesEngaged: false,
    // 1,150 once in a player's lifetime. Amortised over a year for comparison only.
    weekly: () => Math.round(1150 / 52),
  },
  {
    id: 'E. rotating cosmetics, one 300-chip item per week',
    built: 'no — catalogue is finite today',
    punishesEngaged: false,
    weekly: () => 300,
  },
  {
    id: 'F. consumable: 100-chip rebuy, ~2 per week',
    built: 'yes — rebuy_500 exists at 100',
    punishesEngaged: true,   // only the losing player buys it
    weekly: () => 200,
  },
];

console.log('\n══ FAUCET PER PLAYER PER WEEK (post PLAY-NOT-PRESENCE, days 1-7 of a streak) ══');
const faucetWeek = {};
for (const a of ARCHETYPES) {
  let s = 0; for (let d = 1; d <= 7; d++) s += faucetPerDay(d, a.hands);
  faucetWeek[a.name] = s;
  console.log(`  ${a.name.padEnd(30)} +${String(s).padStart(6)} chips/week`);
}

console.log('\n══ CHIPS DESTROYED PER PLAYER PER WEEK, BY CANDIDATE ══');
console.log(`  ${'candidate'.padEnd(42)} ${ARCHETYPES.map(a=>a.name.split(' ')[0].padStart(8)).join(' ')}   built?`);
const removalRegular = {};
for (const c of CANDIDATES) {
  const cells = ARCHETYPES.map((a) => String(c.weekly(a)).padStart(8)).join(' ');
  removalRegular[c.id] = c.weekly(ARCHETYPES[2]);
  console.log(`  ${c.id.padEnd(42)} ${cells}   ${c.built.split(' —')[0]}`);
}

console.log('\n══ NET PER REGULAR PLAYER PER WEEK (faucet MINUS the sink) ══');
const fw = faucetWeek['regular (10 hands/day, at cap)'];
for (const c of CANDIDATES) {
  const net = fw - c.weekly(ARCHETYPES[2]);
  const pct = (100 * c.weekly(ARCHETYPES[2]) / fw).toFixed(1);
  console.log(`  ${c.id.padEnd(42)} +${String(net).padStart(6)}   (sink removes ${pct}% of what they earn)`);
}

/**
 * FLOAT PROJECTION. The existing float is STOCK; a sink only affects FLOW. So the projection
 * starts from today's measured float and adds (faucet - sink) per player per week.
 * COHORT: 26 devices have ever played a hand. That is the honest population, and it is also why
 * none of this can be validated — see the doc.
 */
const COHORT = 26;
console.log(`\n══ FLOAT PROJECTION — ${COHORT} regular players (the real population that has ever played) ══`);
console.log(`  starting float (measured): ${FLOAT_TODAY.toLocaleString()}`);
console.log(`  ${'candidate'.padEnd(42)} ${'after 1 month'.padStart(14)} ${'after 1 year'.padStart(14)}`);
for (const c of CANDIDATES) {
  const perWeek = (fw - c.weekly(ARCHETYPES[2])) * COHORT;
  const m1 = FLOAT_TODAY + perWeek * 4.33;
  const y1 = FLOAT_TODAY + perWeek * 52;
  console.log(`  ${c.id.padEnd(42)} ${Math.round(m1).toLocaleString().padStart(14)} ${Math.round(y1).toLocaleString().padStart(14)}`);
}
const noSink = fw * COHORT;
console.log(`  ${'(no sink at all)'.padEnd(42)} ${Math.round(FLOAT_TODAY + noSink*4.33).toLocaleString().padStart(14)} ${Math.round(FLOAT_TODAY + noSink*52).toLocaleString().padStart(14)}`);

console.log(`\n══ WHAT WOULD IT TAKE TO HOLD THE FLOAT FLAT? ══`);
console.log(`  a regular player earns ${fw}/week, so the sink must remove ${fw}/week to break even.`);
for (const c of CANDIDATES) {
  const w = c.weekly(ARCHETYPES[2]);
  console.log(`    ${c.id.padEnd(42)} removes ${String(w).padStart(5)}  -> ${(100*w/fw).toFixed(0)}% of the way there`);
}
console.log('');

// ── THE QUESTION THE CANDIDATE TABLE DOES NOT ANSWER ────────────────────────────────────────
// Every candidate above removes single-digit percentages of what a player earns, and the float
// grows to ~12M in a year under all of them. So the useful question is not "which sink" but
// "what would have to be true for ANY sink to hold the float flat".
let presenceWeek = 0;
for (let d = 1; d <= 7; d++) presenceWeek += Math.floor(streakBase(d) * PRESENCE_MULT) + rewardBase(d);
console.log('══ THE BINDING CONSTRAINT ══');
console.log(`  presence alone, per player per week, at multiplier ${PRESENCE_MULT}: +${presenceWeek}`);
console.log(`  a player who NEVER PLAYS still mints ${presenceWeek}/week, and NO SINK CAN TOUCH THEM —`);
console.log(`  sinks only reach people who play. So the float cannot be held flat by a sink while`);
console.log(`  the presence grant exists at any meaningful level.`);
console.log('');
console.log('  presence multiplier needed for the 15% rake alone to hold a REGULAR player flat:');
for (const mult of [0.4, 0.2, 0.1, 0.0]) {
  let p = 0; for (let d = 1; d <= 7; d++) p += Math.floor(streakBase(d) * mult) + rewardBase(d);
  const earn = p + PLAY_CAP * 7;
  const sink = 7 * rakePerDay(10, 3, 15);
  console.log(`    multiplier ${mult.toFixed(2)}  earns ${String(earn).padStart(5)}/wk  rake removes ${sink}  -> net ${earn - sink > 0 ? '+' : ''}${earn - sink}`);
}
console.log('');
console.log('  play_grant_daily_cap needed for the 15% rake to hold a regular player flat,');
console.log('  at presence multiplier 0.4 (presence alone already exceeds the sink):');
const sink15 = 7 * rakePerDay(10, 3, 15);
const capNeeded = (sink15 - presenceWeek) / 7;
console.log(`    required cap = (${sink15} - ${presenceWeek}) / 7 = ${capNeeded.toFixed(0)}  <- NEGATIVE. Impossible.`);
console.log('');
