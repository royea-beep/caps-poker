/**
 * BATTLE PASS — CLOSED 2026-09-07, Roye's ruling. REDIRECT, NOT A DELETE.
 *
 * The screen itself is intact at components/BattlePassScreen.tsx, along with
 * stores/battlePassStore.ts, constants/battlePassConfig.ts and utils/battlePass.ts. Nothing was
 * removed. ⚠️ TO REOPEN, CHANGE ONE LINE: return <BattlePassScreen /> instead of the Redirect.
 *
 * ── WHY IT CLOSED, MEASURED RATHER THAN ASSUMED ──────────────────────────────────────────────
 * It was never flag-gated and it was never dark. `app_config.battle_pass_enabled = false` has
 * stood since 2026-03-27 and NO CLIENT CODE READS IT, so the flag gated nothing. The drawer entry
 * was commented out (components/SideMenu.tsx:188), so nothing linked here. But typing the URL
 * rendered the whole thing: "Season 1 — First Deal", a live countdown, a tier track, and
 * "★ UNLOCK PREMIUM — 5,000 chips". Unreachable, fully rendered, promising sixty rewards.
 *
 *   · 0 of the 60 reward ids in constants/battlePassConfig.ts resolve anywhere in the app.
 *   · claimFreeReward() / claimPremiumReward() append a tier number to local AsyncStorage. They
 *     credit NO chips and unlock NO cosmetic. Tier 1 advertises "500 chips" and pays zero.
 *   · upgradeToPremium() asks to spend 5,000 chips and then charges nothing at all.
 *   · THE RICHEST PLAYER IN THE DATABASE HOLDS 3,250 CHIPS. 0 of 393 devices could pay the 5,000
 *     the button asks for, so the offer was unacceptable as well as unbacked.
 *   · 0 battle-pass events have ever been recorded, by anyone.
 *
 * ⚠️ AND IT GOT WORSE ON ITS OWN. The countdown was running: "55d 23h remaining" in a game that
 * has no seasons and no season rollover. Left alone, the first tester to type the URL would have
 * met an EXPIRED season. Closing the door stops that clock being seen.
 *
 * ── WHAT MUST BE TRUE TO REOPEN IT ───────────────────────────────────────────────────────────
 *   1. REAL PLAYERS. Something has to be worth a season. 25 devices have ever played a hand and
 *      no multiplayer room has ever reached `playing`.
 *   2. A CALIBRATED ECONOMY. A premium tier priced above every balance in the database is not a
 *      price, it is a wall. Set it against what players actually hold.
 *   3. REWARDS THAT RESOLVE. All 60 ids must map to something the app can actually grant, and
 *      claiming must credit through chip_transactions like every other economy write.
 *   4. A SEASON THAT ROLLS OVER. A countdown needs something on the other side of zero.
 * Until all four hold, this stays a redirect. ⚠️ A closed door with no note becomes a mystery
 * somebody reopens blind — that is what this comment is for.
 *
 * ── WHAT WAS DELIBERATELY NOT TOUCHED ────────────────────────────────────────────────────────
 * XP. It genuinely accrues: results.tsx:603 calls addXP() after every hand, tiers genuinely
 * advance, and the XP bar on the results screen genuinely shows it. Only the REWARDS were hollow.
 * Nothing a player has earned is lost by closing this route.
 *
 * ── WHY A REDIRECT AND NOT A DELETED FILE ────────────────────────────────────────────────────
 * The same reason as /missions, /heatmap and /simulate, recorded in app/missions.tsx: there is no
 * app/+not-found.tsx, so removing the route would send a typed URL to expo-router's unmatched
 * fallback and a tester could land somewhere with no way back. Bouncing to Home always leaves a
 * way forward and a way back.
 */
import { Redirect } from 'expo-router';

export default function BattlePassClosed() {
  return <Redirect href="/" />;
}
