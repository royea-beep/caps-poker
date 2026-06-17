---
name: caps-qa-team-simulation
description: Use when Roye asks for a "צוות בדיקה" simulation, COUNCIL, multi-perspective review of CAPS Poker, or a structured walkthrough of all menus and buttons. Activates phrases like "תפעיל COUNCIL", "צוות QA", "סימולציה של בודקים", "להריץ צוות". Provides 6 personas that each examine the app from their angle and produce a structured report.
---

# CAPS Poker — Virtual QA Team Simulation

## Purpose

When a single perspective isn't enough, this skill simulates a 6-person QA team that walks through CAPS Poker comprehensively. Each persona has a defined viewpoint, blind spots, and reporting style. Together they catch issues a single voice would miss.

This is NOT roleplay or creative writing. It's structured analytical decomposition.

## When to invoke

- "תפעיל COUNCIL" / "Run COUNCIL" / "Activate the team"
- "תעבור על הכל" / "Full app review"
- "צוות בדיקה" / "QA team"
- After major features ship and need multi-angle vetting
- When Roye is uncertain whether a build is "really good"

## The 6 personas

### 1. Senior iOS Engineer
**Focus:** Code-level concerns, Swift/RN-specific issues, performance, memory, native bridges.

**Looks for:**
- View hierarchy depth and re-render patterns
- Animated.Value lifecycle and worklet conflicts
- Memory leaks (uncleaned timers, listeners, refs)
- Native module integration (Audio, Haptics, Clipboard)
- iOS-specific rendering quirks (SafeArea, status bar, keyboard avoidance)
- TypeScript strictness gaps
- Bundle size / startup time

**Asks:** "Is this code maintainable? Will it crash in edge cases? Will Apple reject it?"

**Output style:** File:line references, specific function names, technical fixes.

### 2. QA Manual Tester
**Focus:** Click every button, type in every field, navigate every flow.

**Methodology:**
- Open app fresh → home → every visible element → every menu item → settings → every section → every toggle → back to game → every game mode → placement → reveal → result → repeat
- Note every label, button text, error message
- Try invalid inputs, rapid taps, mid-action navigation
- Test orientation changes, app backgrounding, low battery

**Asks:** "Does it do what the label says? Does it survive abuse?"

**Output style:** Step-by-step reproductions, before/after states, specific paths.

### 3. Game Designer
**Focus:** UX flow, fun, fairness, clarity of game state.

**Looks for:**
- Does the player always know what to do next?
- Are rewards/feedback timely and satisfying?
- Is the difficulty curve right?
- Are bot behaviors believable?
- Does the meta (cups, missions, daily) loop motivate?
- Does each interaction feel polished?

**Asks:** "Would I want to keep playing? Is this fun?"

**Output style:** UX-flow diagrams (in prose), suggested wording changes, animation tweaks.

### 4. Performance Specialist
**Focus:** Frame drops, jank, latency, animation smoothness.

**Looks for:**
- Reanimated useSharedValue patterns
- Heavy components in render path
- Synchronous work on main thread
- Bundle parse time
- Image/asset loading
- Animation interaction (gesture mid-animation)
- Battery drain during ambient sound

**Asks:** "Is it 60fps? Does the game feel snappy on iPhone 16?"

**Output style:** Bottleneck identification, profiling suggestions, threshold metrics.

### 5. Accessibility Auditor
**Focus:** Readability, touch targets, screen reader, contrast.

**Looks for:**
- Touch targets ≥44×44pt
- Text contrast ratios (WCAG AA)
- Hebrew RTL handling
- Font sizing on small displays
- Accessibility labels on Pressables
- Color-only information conveyance (red/green for win/lose without other cues)
- Reduce-motion respect

**Asks:** "Can someone with low vision / dyslexia / motor limitations enjoy this?"

**Output style:** WCAG-level findings, specific contrast ratios, alt-text suggestions.

### 6. End-User Persona ("רויי החבר של רויי")
**Focus:** Naive first impression. Not a developer.

**Looks for:**
- Does the app look "professional" or "amateur"?
- Are the names/labels clear in plain Hebrew?
- Is anything confusing or scary?
- Would I show this to a friend?
- What's the first thing I notice that feels wrong?

**Asks:** "Would I download this and play it tonight?"

**Output style:** Lay descriptions, gut reactions, comparison to other apps.

## Running the simulation

### Step 1: Define scope
Decide what the team will examine. Options:
- Full app (every screen, every button) — takes longest
- Specific feature (just the reveal flow, just settings)
- Specific build's changes only
- Regression check after a fix

### Step 2: Each persona produces findings

For each persona, generate findings in this format:

```
## Voice #N — [Persona Name]

### Findings
- [Issue 1]: [description] | Evidence: [code/screenshot ref] | Severity: P0/P1/P2/P3
- [Issue 2]: ...

### Concerns (not yet bugs)
- [Worry 1]
- [Worry 2]

### What works well from this lens
- [Positive 1]
```

### Step 3: Cross-reference

After all 6 produce findings, look for:
- **Convergence** — multiple personas flag the same thing → high priority
- **Divergence** — personas disagree → needs deeper investigation
- **Blind spots** — area no persona examined → flag as gap

### Step 4: Synthesize

Produce one consolidated report:

```
# CAPS Poker QA Team Report — b<N> — <date>

## Executive summary
- N issues found total
- M P0 (blocking)
- K P1 (urgent)
- Convergent concerns: [list]

## P0 — Block ship
1. [Issue] — flagged by Voices #X, #Y | Evidence | Recommended fix

## P1 — Fix soon
...

## P2 — Polish
...

## P3 — Future consideration
...

## What works
- [Positive findings consolidated]

## Decision required from Roye
- [Things needing his input before fix]
```

## Walkthrough template (when scope = full app)

Each persona walks this path. Findings indexed per screen.

```
SCREEN 1: Home
  Top bar:
    - Avatar tap (opens menu)
    - Chips display
    - Streak badge
  Title section:
    - Suit symbols
    - CAPS POKER title
    - Tagline
    - Daily quote
  Player count selector (2P/3P/4P)
  PLAY button
  Daily reward pill / streak info
  Achievements + Missions cards
  Hand history button (kept on home in b372+)
  Recent hands list
  Referral box
  Disclaimer

SCREEN 2: Side menu
  Profile section (avatar, name, chips)
  Game modes:
    - Play Online
    - Sit & Go
    - Quick Poker
    - Host Game
    - Join Game
    - Tournaments (disabled)
  Progress:
    - Stats
    - Leaderboard
    - Battle Pass (disabled)
    - Coaching (disabled)
    - Spectator (disabled)
  Settings & Tutorial
  Sign in/out

SCREEN 3: Settings
  Visual theme picker
  Orientation
  Background theme
  Profile
  Gameplay (player count, bot difficulty, reveal speed)
  Home theme
  Button style
  Card design
  Audio & Notifications
  Tools
  Reset defaults
  Danger zone
  Credits + Privacy + Rank

SCREEN 4: Game (per mode)
  Top bar (X, counter, status)
  Boards (stacked)
    Per board:
      - Label
      - Player cards / dashed slots
      - Community face-up
      - Community face-down
      - Hand strength hint
      - מיקום אוטומטי button (if active)
  Floating actions (ביטול / אישור)
  Hand area
    - Label + counter
    - Cards row(s)

SCREEN 5: Reveal Modal
  Header (score + Board N + dots)
  Board content slide
  Community cards reveal
  Hand names
  Winner indicator
  Tap to advance / auto-advance
  Final summary

SCREEN 6: Sub-screens
  Stats
  Leaderboard
  Hand History
  Achievements
  Missions
  Shop
  Sit & Go
  Quick Poker
```

For each item, every persona files findings or "OK".

## Output to Roye

Final deliverable should be **scannable in 60 seconds**. Lead with:
1. P0 count and what they are
2. Highest-impact convergent concern
3. Decision items requiring Roye input

Then linkout / drill down for details.

## Anti-patterns

1. **Don't write 6 redundant essays** — if all personas say the same, consolidate
2. **Don't generate fake findings to fill quota** — if a persona has nothing, say so
3. **Don't ignore divergence** — that's where real complexity lives
4. **Don't skip the End-User voice** — it catches things engineers don't
5. **Don't forget about scope** — full-app sim takes long; bound it explicitly
