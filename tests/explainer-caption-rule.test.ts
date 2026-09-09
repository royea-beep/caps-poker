/**
 * THE CAPTION OUTCOME RULE, pinned in both directions.
 *
 * The failure it exists for: a caption reading "Nobody wins" burned over a screen reading YOU WIN.
 * A frame classifier cannot catch that — it can prove a caption sits over the results screen, not
 * that the words are true of that instant. So captions are forbidden from asserting a result.
 *
 * ⚠️ THE FIRST VERSION OF THIS RULE WAS TOO BLUNT AND IS THE REASON THIS TEST EXISTS. Forbidding
 * any win-word failed two CORRECT captions on the first run — "The score is boards won, not chips"
 * (a scoring rule) and "hands, win rate, streak and chips" (a statistic printed on the screen). A
 * guard that fails correct content teaches the next person to delete the guard.
 */
const OUTCOME_CLAIM = [
  /\byou\s+(win|won|lose|lost|tie|tied|draw)\b/i,
  /\bnobody\s+(wins|won|loses|lost)\b/i,
  /\b(it'?s|its)\s+a\s+(tie|draw)\b/i,
  /\beveryone\s+(wins|won|ties|tied)\b/i,
  /^\s*(tie|draw|you win|you lose|winner|loser)\s*[.!]?\s*$/i,
];
const claimsResult = (s: string) => OUTCOME_CLAIM.some((re) => re.test(s));

describe('explainer caption outcome rule', () => {
  const MUST_BE_CAUGHT = [
    'Nobody wins',            // the actual historical failure
    'You win',
    'YOU LOSE',
    "It's a tie",
    'Its a draw',
    'TIE',
    'Everyone wins',
    'you tied this one',
  ];
  // Every caption currently shipped, plus the two the blunt version wrongly rejected.
  const MUST_BE_ALLOWED = [
    'HOME — where every session starts',
    'Play Online, or practise against bots',
    'A daily bonus tops up your chips',
    'PLACING — the decision that is the game',
    'Four cards per board. You choose where',
    'Auto-Place fills a board fast. Then READY',
    'REVEAL — the boards play out one at a time',
    'Live odds while cards are still to come',
    'Each board is named and settled on its own',
    'RESULTS — boards decide the hand',
    'The score is boards won, not chips',      // a scoring RULE, not a result
    'Hand details opens the breakdown',
    'HAND HISTORY — your past hands',
    'Practice hands are not recorded',
    'Play for chips and every hand lands here',
    'PROFILE — hands, win rate, streak and chips',  // a STATISTIC on screen
    'Achievements, hand history and detailed stats',
    'Cups and settings live here too',
    'LOBBY — tables against real people',
    'Heads-up, 3-player or 4-player',
    'Fewer players, more boards: 2 play 4',
    'CHIP SHOP — reached from your chip count',
    'Empty today. Nothing is for sale',
  ];

  it.each(MUST_BE_CAUGHT)('rejects a caption that asserts a result: %s', (s) => {
    expect(claimsResult(s)).toBe(true);
  });

  it.each(MUST_BE_ALLOWED)('allows a caption that names a rule or a statistic: %s', (s) => {
    expect(claimsResult(s)).toBe(false);
  });

  it('matches the rule the verifier actually enforces', () => {
    const fs = require('fs');
    const src = fs.readFileSync('tools/explainer-verify.mjs', 'utf8');
    for (const re of OUTCOME_CLAIM) expect(src).toContain(re.source);
  });

  it('every shipped caption passes the rule', () => {
    const fs = require('fs');
    const clips = JSON.parse(fs.readFileSync('docs/explainers/clips.json', 'utf8'));
    const bad = clips.flatMap((c: any) => c.captions.filter(claimsResult));
    expect(bad).toEqual([]);
  });
});
