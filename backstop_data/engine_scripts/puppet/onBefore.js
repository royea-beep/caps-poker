/**
 * BackstopJS onBefore hook — seeds localStorage from tests/caps-onboarded.json
 * so every scenario navigates with caps_language + caps-poker-storage already set,
 * skipping the smart-default reseed paint on each capture.
 *
 * Runs before navigation: we register the seeded data via evaluateOnNewDocument
 * so the first script tick on the page already sees the persisted state.
 */
const fs = require('fs');
const path = require('path');

const STATE_PATH = path.join(__dirname, '..', '..', '..', 'tests', 'caps-onboarded.json');

/** Mirrors components/InteractiveTutorial.tsx's exported key. Kept as a literal because this hook
 *  runs in plain Node under BackstopJS and cannot import from the TSX module. */
const INTERACTIVE_TUTORIAL_KEY = 'has_seen_interactive_tutorial';

/** app/game.tsx's first-hand coaching tips (its GAMES_PLAYED_KEY). A SECOND overlay, gated on a
 *  DIFFERENT key from the tutorial above — seeding only that one is not enough, which is exactly
 *  how this was missed. The tips render a toast AND dim the whole screen: in the 2026-08-27
 *  recapture the /game reference came back with "These are your cards. Place 4 on each board."
 *  frozen in and every colour behind a ~0.61 veil — the card face photographed rgb(156,155,150)
 *  where the token is #FCFAF3. That baseline would have made a dimmed, coached screen the
 *  definition of a correct game board, the same way the home baseline once froze in a modal.
 *  A baseline must show the app, not its first run. */
const GAMES_PLAYED_KEY = 'caps_games_played';

module.exports = async (page, _scenario, _viewport, _isReference, _browserContext) => {
  let entries = {};
  try {
    const raw = fs.readFileSync(STATE_PATH, 'utf8');
    const state = JSON.parse(raw);
    const ls = state?.origins?.[0]?.localStorage ?? [];
    for (const { name, value } of ls) entries[name] = value;
  } catch (e) {
    console.warn('[backstop:onBefore] storageState load failed:', e.message);
    return;
  }
  // THE FIRST-RUN TUTORIAL. app/(tabs)/index.tsx reads `has_seen_interactive_tutorial` and, when
  // it is absent, opens the InteractiveTutorial over the home screen. The bootstrapped
  // storageState does not carry that key, so every capture of / caught the modal and the committed
  // home baseline is a photograph of an overlay rather than of the screen. A baseline must show the
  // app, not its first-run state, so the key is seeded here alongside the rest.
  entries[INTERACTIVE_TUTORIAL_KEY] = 'true';
  // THE FIRST-HAND COACHING TIPS — the /game equivalent, and a separate key. See the constant
  // above: seeding the tutorial key alone left /game photographing a toast over a dimmed screen.
  entries[GAMES_PLAYED_KEY] = '25';

  await page.evaluateOnNewDocument((kv) => {
    try {
      for (const k of Object.keys(kv)) localStorage.setItem(k, kv[k]);
    } catch (_) { /* localStorage may be unavailable for some scenarios */ }
  }, entries);
};
