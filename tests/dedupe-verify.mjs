// VAMOS-CAPS DEDUPE-QA verification: fresh first-run shows exactly ONE onboarding;
// each function has one entry point.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = 'http://localhost:8093';
const OUT = 'tests/screenshots/dedupe';
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[dedupe]', ...a);

const browser = await chromium.launch({ headless: true });

// --- Fresh first-run: clean context (empty localStorage) ---
const ctx = await browser.newContext({ viewport: { width: 430, height: 900 } });
const p = await ctx.newPage();
await p.goto(BASE, { waitUntil: 'domcontentloaded' });
await sleep(9000); // boot + gamesPlayed load + tutorial gate
const body1 = await p.evaluate(() => document.body.innerText);
await p.screenshot({ path: `${OUT}/firstrun-1.png` });

// Detect which onboarding surfaces are present
const has = (re) => re.test(body1);
const surfaces = {
  WebLandingHero_PLAY_NOW: has(/PLAY NOW/i),
  OnboardingOverlay_WhatIsCAPS: has(/What is CAPS|DEAL ME IN/i),
  InteractiveTutorial: has(/cards per board|TAP A CARD|Win ALL boards/i),
  WelcomeModal_skipTutorial: has(/Skip tutorial/i),
};
log('first-run surfaces present:', JSON.stringify(surfaces));
const onboardingCount = Object.values(surfaces).filter(Boolean).length;
log('ONBOARDING SURFACE COUNT =', onboardingCount, onboardingCount === 1 ? '(PASS: exactly one)' : '(CHECK)');

// Dismiss the one onboarding (skip) and confirm NO second onboarding appears
try {
  const skip = p.getByText(/^(Skip|דלג)$/).first();
  if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) { await skip.click(); await sleep(2500); }
} catch {}
const body2 = await p.evaluate(() => document.body.innerText);
const after = {
  OnboardingOverlay: /What is CAPS|DEAL ME IN/i.test(body2),
  InteractiveTutorial: /cards per board|TAP A CARD/i.test(body2),
  WelcomeModal: /Skip tutorial/i.test(body2),
};
log('after dismiss — any onboarding still/again showing?', JSON.stringify(after));
await p.screenshot({ path: `${OUT}/firstrun-2-after-skip.png` });

// --- Entry-point checks (returning user: mark onboarding seen) ---
const ctx2 = await browser.newContext({ viewport: { width: 430, height: 900 } });
const q = await ctx2.newPage();
await q.addInitScript(() => { try { localStorage.setItem('has_seen_interactive_tutorial', 'true'); } catch {} });
const entries = {};
const collect = async (path, key) => {
  await q.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  const labels = await q.evaluate(() => Array.from(document.querySelectorAll('[aria-label],[role="button"]')).map(e => (e.getAttribute('aria-label') || e.textContent || '').trim()));
  entries[key] = labels;
};
await collect('/play', 'play');
await collect('/friends', 'friends');
await collect('/profile', 'profile');

const joinAll = (arr) => (arr || []).join(' | ');
const r = {
  play_singlePlayer: /Single Player/i.test(joinAll(entries.play)),
  play_lobby: /Multiplayer Lobby/i.test(joinAll(entries.play)),
  friends_lobby: /Multiplayer Lobby/i.test(joinAll(entries.friends)),
  friends_oldHostJoin: /Host Online|Join Game/i.test(joinAll(entries.friends)),
  friends_leaderboard: /Leaderboard|Rankings|טבלת/i.test(joinAll(entries.friends)),
  profile_leaderboard: /Leaderboard|Rankings|טבלת/i.test(joinAll(entries.profile)),
};
log('ENTRY POINTS:', JSON.stringify(r, null, 2));

await browser.close();
log('DONE');
