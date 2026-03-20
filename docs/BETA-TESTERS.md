# Caps Poker — Beta Tester Program
**Date:** 2026-03-20 | **Stage:** Launch Prep (Stage 7)

---

## Current Beta Access

| Channel | URL / Method | Status |
|---------|-------------|--------|
| Web | https://caps.ftable.co.il | ✅ Live — anyone can access |
| TestFlight | EAS build #117 (v1.9.3 b105) | ✅ Available — needs invite |
| iOS production | App Store | ⏸️ PAUSED — not submitted |

---

## TestFlight Invite Process

1. Open **App Store Connect** → Caps Poker → TestFlight
2. Add tester email under "External Testers" group
3. TestFlight sends email invite
4. Tester installs TestFlight app + accepts invite

URL: https://appstoreconnect.apple.com/apps/6760429619

---

## Who Should Test (Priority Order)

### Tier 1 — Core testers (most important feedback)
| Tester | What to test | Why |
|--------|-------------|-----|
| Roye (yourself) | All — Five-O theme, landscape, multiplayer, WhatsApp | Primary QA |
| 1–2 poker friends | Single player + local multiplayer on same WiFi | Real user perspective |

### Tier 2 — Multiplayer QA
| Scenario | Min testers needed | What to verify |
|----------|-------------------|---------------|
| Local WiFi (HOST+JOIN) | 2 iPhones, same WiFi | TCP socket stability |
| Internet multiplayer | 2 iPhones, any network | Supabase Realtime latency |
| 4-player local | 4 iPhones | Board count = 2, all cards dealt |

### Tier 3 — Device coverage
| Device | Priority | Why |
|--------|----------|-----|
| iPhone SE (2nd gen) | High | Smallest screen — fits title/buttons? |
| iPhone 16 Pro Max | High | Largest screen — no overflow? |
| iPad | Medium | Web version at wide width |
| Android (web) | Low | Chrome on Android |

---

## QA Script for Beta Testers

Give each tester this checklist:

```
Caps Poker Beta Test — v1.9.3

FIRST LAUNCH
[ ] App opens → theme picker appears (Classic / Five-O)
[ ] Choose theme → orientation picker appears
[ ] Choose orientation → home screen

SINGLE PLAYER
[ ] START GAME → cards dealt → place cards on boards
[ ] Press READY → reveal starts → winner shown
[ ] REMATCH works
[ ] WIN/LOSE banners readable

VISUAL THEMES
[ ] SETTINGS → VISUAL STYLE → switch Classic ↔ Five-O
[ ] Classic: dark black + gold felt
[ ] Five-O: dark navy + gold + crimson boards

LANDSCAPE (if orientation = landscape)
[ ] Rotate iPhone → 3-panel layout (Your Hand | Boards | Bot Hand)
[ ] Cards readable in landscape

SOUND
[ ] Card sounds play when placing
[ ] Win/lose sound plays
[ ] Timer low sound plays

BUG REPORTER
[ ] Shake phone → bug modal appears
[ ] Submit bug → get confirmation
```

---

## Known Issues (tell testers in advance)

- Twilio WhatsApp bot pending (set webhook URL — ETA: manual 30 seconds)
- Google Sign-In requires Supabase dashboard config (pending)
- Internet multiplayer works but not stress-tested with 3+ simultaneous sessions

---

## Feedback Collection

Primary channel: WhatsApp to Roye directly
Secondary: Bug reporter (shake phone in app)
Tertiary: TestFlight feedback form
