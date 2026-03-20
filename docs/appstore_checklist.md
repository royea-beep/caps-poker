# App Store Submission Checklist
> ⏸️ **TRACK PAUSED** — Do not act on this file until Roye explicitly says "resume App Store". Never mention App Store proactively.

## Current State (2026-03-14)
- **Build 15** (v1.1.0, production profile) — FINISHED, ready for submission
- **TypeScript:** 0 errors
- **Tests:** 112/112 passing
- **Web:** https://caps.ftable.co.il — LIVE
- **app.json version:** 1.2.0 (note: build 15 was built with v1.1.0)
- **Screenshots:** 3 per size (6.7" and 6.1") — home, game, results

## Prerequisites — TestFlight Validation

- [ ] Open TestFlight on your iPhone
- [ ] Install build 15 (v1.1.0) if not already installed
- [ ] Play one full hand (single player, 2 players)
- [ ] Verify chips update correctly after hand
- [ ] Check leaderboard screen loads (requires internet)
- [ ] Test sound effects on real device
- [ ] Test haptic feedback
- [ ] Verify Settings screen — change timer, player count, boards
- [ ] Play a second hand with changed settings to confirm they apply

## Screenshots Check

Available:
- `screenshots/6.7/` — home.png, game.png, results.png (3 files)
- `screenshots/6.1/` — home.png, game.png, results.png (3 files)

**Warning:** The screenshots README mentions 5.5" (iPhone 8 Plus, 1242x2208) is also required. We do NOT have 5.5" screenshots. Apple requires at least 6.5"/6.7" screenshots; 5.5" may be optional for new submissions but check App Store Connect.

**Tip:** Consider adding a 4th screenshot (multiplayer lobby) if possible — App Store allows up to 10 and more screenshots improve conversion.

## In App Store Connect

URL: https://appstoreconnect.apple.com/apps/6760429619

### App Information Tab
- [ ] Name: **CAPS Poker**
- [ ] Subtitle: **Multi-Board Omaha Card Game**
- [ ] Primary Category: **Games**
- [ ] Secondary Category: **Card**
- [ ] Primary Language: **English (U.S.)**

### Pricing and Availability
- [ ] Price: **Free** (Tier 0)
- [ ] Available in all territories (or select specific ones)

### Age Rating
- [ ] Fill out the Age Rating questionnaire
- [ ] Simulated Gambling: **Yes** (this sets the rating to 17+)
- [ ] All other categories: **No** (no real money, no violence, etc.)

### Version 1.0 — Prepare for Submission

#### Version Information
- [ ] **What's New:**
  ```
  Initial public release:
  - Multi-board Omaha poker with 2-4 players
  - Local WiFi multiplayer with room codes
  - Sound effects and haptic feedback
  - Fully customizable game settings
  ```
- [ ] **Description:**
  ```
  CAPS Poker — a fast-paced multi-board card game based on Omaha poker.

  Place your cards across 2-4 simultaneous boards. Each board is a separate
  Omaha hand with its own pot. Win all boards to earn the COMPLETE bonus —
  50% extra from every opponent.

  Features:
  - 2, 3, or 4 player modes (vs bots or local WiFi multiplayer)
  - Full Omaha evaluation — exactly 2 player cards + 3 board cards
  - Timer-based gameplay — think fast
  - Local WiFi multiplayer via room code
  - No ads. No internet required.

  Simple to learn. Impossible to master.
  ```
- [ ] **Promotional Text:**
  ```
  A unique multi-board Omaha poker game. Play against bots or friends on local WiFi!
  ```
- [ ] **Keywords:**
  ```
  poker, omaha, card game, multiplayer, caps, board game, strategy, local multiplayer, wifi
  ```
- [ ] **Support URL:** https://caps.ftable.co.il
- [ ] **Marketing URL:** https://caps.ftable.co.il
- [ ] **Privacy Policy URL:** https://caps.ftable.co.il/privacy.html

#### Screenshots
- [ ] Upload 6.7" screenshots (from `screenshots/6.7/`): home.png, game.png, results.png
- [ ] Upload 6.1" screenshots (from `screenshots/6.1/`): home.png, game.png, results.png
- [ ] Upload 5.5" screenshots if required by App Store Connect (we don't have these yet)

#### Build
- [ ] Select **Build 15** (v1.1.0) from the build list
- [ ] If build 15 doesn't appear, it may need to be submitted to TestFlight first via EAS Submit or manually uploaded

#### App Review Information
- [ ] Contact: **royearguan@gmail.com**
- [ ] Demo Account: **Not needed** (no login required)
- [ ] Notes for Reviewer:
  ```
  This is a single-player card game with optional local WiFi multiplayer.
  No internet connection required. No real money or in-app purchases.
  Virtual chips have no monetary value.
  ```

### Final Submit
- [ ] Review all fields one more time
- [ ] Click **"Submit for Review"**

## Post-Submission

- [ ] Monitor review status in App Store Connect (typical review: 24-48 hours)
- [ ] Respond to any rejection feedback within 24 hours
- [ ] Common rejection reasons to watch for:
  - Missing 5.5" screenshots (if required)
  - Gambling disclaimer issues — emphasize "no real money"
  - Privacy policy not loading — verify https://caps.ftable.co.il/privacy.html is live
- [ ] Once approved, the app goes live automatically (unless you set manual release)

## Version Mismatch Note

The `app.json` currently shows version `1.2.0`, but build 15 was built with `1.1.0`. This is fine for submitting build 15. If you need a new build later, the next one will be v1.2.0 build 16.
