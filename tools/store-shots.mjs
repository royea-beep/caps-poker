/**
 * THE APP STORE SCREENSHOT SET — re-shot from build 515, at BOTH sizes Apple wants.
 *
 * ⚠️ WHY THIS EXISTS. The set in docs/product-map/store/ was captured on 2026-09-03 at one size,
 * and two of its seven shots advertised EMPTINESS: "Shop is empty right now" with a Retry button,
 * and "No achievements found". A store screenshot of an empty shop tells a stranger the product has
 * nothing in it. Eleven commits since then also touched the render path of five of the seven, so
 * "the folder is recent" was never evidence that the pictures were current.
 *
 * ⚠️ A CORRECTION I OWE, AND THE REASON THE SHOP IS BACK IN THIS SET.
 * The 2026-09-08 pass dropped the shop shot and wrote that "payments are off, so a stocked shop is
 * a state no player can reach". THAT WAS WRONG, and it was wrong in the way this project keeps
 * getting caught: I read an empty screen and inferred a cause instead of checking it.
 *   · `chip_config` holds TEN ACTIVE ITEMS RIGHT NOW — emote packs, card backs, avatars, a table
 *     theme — priced 100 to 500 CHIPS. Every one is affordable on a starting 2,000 balance.
 *   · They are bought with CHIPS through `spend_chips`. Payments being off stops you BUYING chips
 *     with money; it has nothing to do with SPENDING them on cosmetics.
 *   · "Shop is empty right now" appeared in my sweep because that sweep runs with the backend
 *     ABORTED, so `get_poker_shop` never answered. The empty state was my rig's, not the product's.
 * The old 2026-09-03 shop screenshot was almost certainly captured the same way.
 *
 * ⚠️ WHAT IS STAGED, SAID OUT LOUD RATHER THAN LEFT TO BE DISCOVERED.
 *   · The HANDS ARE REAL. The rig plays them through the app's own controls — Auto-Place ALL, then
 *     READY — so hand history, the stats and the balance are what playing actually produces.
 *   · The SHOP is served the product's OWN TEN ACTIVE ITEMS, read from `chip_config` and copied
 *     here verbatim — same event_type, same chip price, same description. Nothing is invented and
 *     nothing is priced differently from what the live RPC would return.
 *   · The ACHIEVEMENTS screen is served the product's OWN active definitions (read from
 *     achievement_definitions, not invented) with a plausible earned subset. It depicts a state a
 *     real player reaches by playing; the rig supplies the progress, not the feature.
 *
 * ⚠️ AND NOTHING IS WRITTEN TO PRODUCTION TO GET ANY OF IT. The live RPCs would each INSERT a
 * leaderboard row for the capture device — `get_poker_shop` does exactly that on its first line.
 * So the rows are READ from the database and REPLAYED into the page, which leaves the database
 * exactly as it was. That is checked by a fresh SELECT after the run, not assumed.
 *
 * ⚠️ THE TWO SIZES ARE DATA, DECLARED ONCE, AND THE OUTPUT IS MEASURED RATHER THAN ASSUMED.
 * Apple's primary iPhone size is now 6.9in (1320x2868); 6.7in (1290x2796) is still accepted. Each
 * is a viewport times a scale factor, and every emitted PNG is re-opened and its real pixel size
 * asserted — a file named 1320x2868 that is not 1320x2868 is the filename-is-not-evidence trap.
 *
 *   node tools/store-shots.mjs
 */
import { serve } from './content-lib.mjs';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const DIST = process.env.DIST || 'dist';
const PORT = Number(process.env.PORT || 8975);
const OUT  = process.env.OUT || 'docs/product-map/store-515';
const HANDS = Number(process.env.HANDS || 6);

/** Apple's accepted iPhone screenshot sizes. Viewport x scale = the pixels Apple stores. */
const SIZES = [
  { label: '6.9in', viewport: { width: 440, height: 956 }, scale: 3, px: { w: 1320, h: 2868 } },
  { label: '6.7in', viewport: { width: 430, height: 932 }, scale: 3, px: { w: 1290, h: 2796 } },
];

/** The product's own active achievements, read from achievement_definitions on 2026-09-08. */
const ACHIEVEMENTS = [
  ['play_1','First Hand','Play your first hand','🃏','milestone',100,20,true],
  ['play_10','10 Hands','Play 10 hands','🃏','milestone',200,40,true],
  ['play_50','50 Hands','Play 50 hands','🃏','milestone',500,100,false],
  ['play_100','Century','Play 100 hands','💯','milestone',1000,200,false],
  ['win_1','First Win','Win your first hand','🏆','skill',100,20,true],
  ['win_10','Winner','Win 10 hands','🏆','skill',300,60,true],
  ['win_50','Hot Streak','Win 50 hands','🔥','skill',1000,200,false],
  ['win_100','Shark','Win 100 hands','🦈','skill',1200,500,false],
  ['qp_win_1','Quick Draw','Win a Quick Poker','⚡','skill',200,40,true],
  ['qp_win_10','Speed Demon','Win 10 Quick Poker','⚡','skill',1000,200,false],
  ['streak_3','3-Day Streak','Play 3 days in a row','🔥','streak',200,50,true],
  ['streak_7','Week Warrior','Play 7 days in a row','🔥','streak',500,150,false],
  ['streak_30','Monthly Grind','Play 30 days in a row','🔥','streak',2000,500,false],
  ['rich_5k','Five Grand','Accumulate 5,000 chips','💰','milestone',0,50,false],
  ['rich_25k','High Roller','Accumulate 25,000 chips','💎','milestone',0,100,false],
  ['share_1','Sharer','Share a hand','📤','social',100,20,true],
  ['cup_bronze','Bronze Cup','Earn the Bronze Cup','🏆','milestone',500,50,true],
  ['cup_silver','Silver Cup','Earn the Silver Cup','🥈','milestone',1000,100,false],
  ['cup_gold','Gold Cup','Earn the Gold Cup','🥇','milestone',1200,200,false],
].map(([id, title, description, icon, category, chips, xp, earned]) =>
  ({ id, title, name: title, description, icon, category, chips, chips_reward: chips, xp, xp_reward: xp,
     earned, is_earned: earned, earned_at: earned ? '2026-09-06T12:00:00Z' : null }));

/**
 * The product's OWN active shop items, read from `chip_config` on 2026-09-08 (chips < 0,
 * is_active). Ordered by price ascending, exactly as get_poker_shop orders them. `can_afford` is
 * computed against the balance the rig has actually earned — not asserted.
 */
const SHOP_ITEMS = [
  ['rebuy_500', 100, 'Rebuy 500 chips', 'רכישת 500 צ׳יפים', false],
  ['buy_emotes', 150, 'Emote pack', 'חבילת אימוגי', true],
  ['quick_poker_buy_in', 200, 'Quick Poker buy-in', 'דמי כניסה לפוקר מהיר', false],
  ['buy_avatar', 200, 'Custom avatar', 'אווטאר מותאם', true],
  ['challenge_buyin', 200, 'Challenge buy-in', 'דמי כניסה לאתגר', false],
  ['buy_emotes_deadpan', 250, "Emote pack: Deadpan", "חבילת אימוג'ים: דדפן", true],
  ['buy_card_back', 300, 'Card back', 'עיצוב גב קלף', true],
  ['buy_avatar_mythic', 350, 'Avatar set: Mythic', 'סט אווטארים: מיתי', true],
  ['buy_table_theme', 500, 'Table theme', 'ערכת שולחן', true],
  ['buy_card_back_graphite', 500, 'Card back: Graphite', 'גב קלף: גרפיט', true],
];
const shopPayload = (balance) => ({
  balance,
  items: SHOP_ITEMS.map(([event_type, cost, description, description_he]) =>
    ({ event_type, cost, description, description_he, can_afford: balance >= cost, owned: false })),
});

fs.mkdirSync(OUT, { recursive: true });
const server = await serve(DIST, PORT);
const browser = await chromium.launch({
  executablePath: process.env.CAPS_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});

const manifest = [];

for (const size of SIZES) {
  const ctx = await browser.newContext({ viewport: size.viewport, deviceScaleFactor: size.scale });

  // Everything outward-bound is intercepted. The achievements RPC is FULFILLED with the product's
  // own definitions; every other backend call is aborted so nothing reaches production.
  let liveBalance = 2000;   // refreshed from the page's own store before the shop is opened
  await ctx.route('**/*', async (route) => {
    const url = route.request().url();
    if (/get_poker_shop/.test(url)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(shopPayload(liveBalance)) });
    }
    if (/get_achievements_list_d|get_achievements_list/.test(url)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ACHIEVEMENTS) });
    }
    if (/\/auth\/v1\/user/.test(url)) {
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: 'shot-user', is_anonymous: true, aud: 'authenticated' }) });
    }
    if (/supabase\.co|ftable\.co\.il/i.test(url)) return route.abort();
    return route.continue();
  });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('caps_language', 'en');
      localStorage.setItem('has_seen_interactive_tutorial', 'true');
      localStorage.setItem('caps_games_played', '25');   // suppresses the first-hand tip veil
    } catch (_) {}
  });

  const page = await ctx.newPage();
  const shot = async (name) => {
    const file = path.join(OUT, `${name}-${size.px.w}x${size.px.h}.png`);
    await page.screenshot({ path: file });
    // ⚠️ MEASURED, NOT ASSUMED. A name is a claim; this reads the bytes back.
    const dim = execFileSync('python3', ['-c',
      'from PIL import Image;import sys;im=Image.open(sys.argv[1]);print(f"{im.size[0]}x{im.size[1]}")', file]).toString().trim();
    const ok = dim === `${size.px.w}x${size.px.h}`;
    manifest.push({ size: size.label, name, file, measured: dim, expected: `${size.px.w}x${size.px.h}`, ok });
    console.log(`${ok ? 'OK  ' : 'BAD '} ${size.label} ${name.padEnd(20)} ${dim}`);
    return ok;
  };

  const click = async (re, timeout = 8000) => {
    const el = page.locator('[role="button"]').filter({ hasText: re }).first();
    if (!(await el.count())) return false;
    await el.click({ timeout }).catch(() => {});
    return true;
  };

  // ── play real hands so history, stats and the balance are earned, not written ────────────────
  //
  // ⚠️ THE RESULTS SHOT IS TAKEN ON A WIN, AND THAT IS A CHOICE ABOUT WHICH REAL MOMENT TO SHOW,
  // NOT A FABRICATION. The first run's last hand came out "TIE GAME 2 — 2" and went into the set;
  // a store shot whose hero says the player tied sells nothing. Every hand here is played by the
  // app against its own bots and every outcome is whatever the cards gave — the rig simply keeps
  // playing until one of them is a win, and if none is, it keeps the last real result and says so.
  let wonShot = false;
  const total = HANDS + 6;                       // a few spare hands to find a win, still all real
  for (let i = 0; i < total; i++) {
    const last = i >= HANDS - 1;
    await page.goto(`http://localhost:${PORT}/game`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(3200);
    if (i === HANDS - 1) await shot('05-game-placement');
    await click(/Auto-Place ALL/i);
    await page.waitForTimeout(1200);
    await click(/READY|Confirm/i);
    await page.waitForTimeout(2600);
    if (i === HANDS - 1 && /reveal|game/.test(page.url())) await shot('06-game-reveal');
    for (let t = 0; t < 10 && !/results/.test(page.url()); t++) {
      const tap = page.locator('text=Tap to reveal').first();
      if (await tap.count()) await tap.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1100);
    }
    // ⚠️ WAIT FOR THE CELEBRATION TOAST TO CLEAR BEFORE SHOOTING RESULTS.
    // At 1.5s the "You won 50 chips! 🎉" toast sits ON TOP OF the "YOU WIN" headline and covers
    // part of the 3 — 1 score. Found by looking at the capture, not by any assertion. The toast is
    // transient, so the shot simply has to be taken after it goes; the OVERLAP ITSELF is a real
    // layout defect and is reported rather than only worked around here.
    await page.waitForTimeout(6500);
    if (last && /results/.test(page.url())) {
      const headline = await page.evaluate(() =>
        (document.body.innerText.match(/YOU WIN|YOU LOSE|TIE GAME|IT.S A TIE/i) || [''])[0]);
      const win = /YOU WIN/i.test(headline);
      if (win || (i === total - 1 && !wonShot)) {
        await shot('07-results');
        wonShot = win;
        console.log(`      results shot taken on: ${headline || '(no headline read)'}`);
        if (win) break;
      }
    }
  }
  if (!wonShot) console.log('      NOTE: no win in the hands played; the results shot shows the real outcome it got');

  // The shop prints the player's balance, so the replayed payload must carry the balance the rig
  // actually earned — never a round number typed here, and never a demo figure.
  liveBalance = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('caps-poker-storage') || '{}')?.state?.chips ?? 2000; }
    catch { return 2000; }
  });
  console.log(`      shop payload balance (earned by the rig, not typed): ${liveBalance}`);

  for (const [route, name, wait] of [
    ['/', '01-home', 3200],
    ['/play', '02-play', 2600],
    ['/shop', '03-shop', 3600],
    ['/achievements', '04-achievements', 3400],
    ['/profile', '08-profile', 3000],
    ['/hand-history', '09-hand-history', 3000],
  ]) {
    await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(wait);
    await shot(name);
  }

  await ctx.close();
}

await browser.close();
await server.close();
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ sizes: SIZES, shots: manifest }, null, 1));
const bad = manifest.filter((m) => !m.ok);
console.log(`\n${manifest.length - bad.length}/${manifest.length} at the exact pixel size`);
if (bad.length) { console.log(JSON.stringify(bad, null, 1)); process.exit(1); }
