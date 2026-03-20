# Caps Poker — Competitive Analysis
**Date:** 2026-03-20 | **Version:** v1.9.3 | **Stage:** Research (Stage 2)

---

## Market Position

Caps Poker is a **multi-board Omaha evaluation game** — distinct from standard poker apps because:
1. Players arrange cards across multiple boards simultaneously (2–4 boards)
2. No betting, no real money — pure strategy/evaluation game
3. Simultaneous reveal across all boards with probability tracking
4. Local + internet multiplayer without accounts required

---

## Direct Competitors

### 1. PokerStars (Mobile)
| Attribute | PokerStars | Caps Poker |
|-----------|-----------|-----------|
| Game type | Texas Hold'em, Omaha, tournaments | Multi-board Omaha evaluation |
| Platform | iOS + Android | iOS + Web (RN+Expo) |
| Multiplayer | Internet (real money) | Local WiFi + Supabase Realtime |
| Monetization | Rake (real money) | Free app |
| UI complexity | Complex lobby/chips | Minimal, game-focused |
| Target | Serious poker players | Casual + friend groups |
| **Advantage** | Brand recognition, real money | **Zero friction, no account needed for local play** |

### 2. Governor of Poker 3
| Attribute | GOP3 | Caps Poker |
|-----------|------|-----------|
| Game type | Texas Hold'em tournaments | Omaha multi-board |
| Monetization | IAP, coins | Free |
| Social | Facebook integration | WhatsApp bot, local play |
| **Advantage** | Large player base | **Omaha focus, multi-board unique mechanic** |

### 3. Zynga Poker
| Attribute | Zynga Poker | Caps Poker |
|-----------|------------|-----------|
| Game type | Texas Hold'em | Omaha 4-board |
| Platform | iOS/Android/FB | iOS + Web |
| Monetization | IAP chips | Free |
| **Advantage** | Social graph, polish | **Unique game format, no social login required** |

### 4. Chinese Poker (Open Face Chinese) apps
| Attribute | OFC Apps | Caps Poker |
|-----------|---------|-----------|
| Game type | Multi-board arrangement (3 boards) | Multi-board Omaha (2–4 boards) |
| Similarity | **Closest concept** | Similar simultaneous arrangement mechanic |
| Difference | 13 cards, 3 boards, scoring system | 4 cards per hand, Omaha rules, flexible board count |
| **Advantage** | Established niche | **Omaha evaluation = stronger hand combinations** |

---

## Indirect Competitors

| App | Why indirect | Caps advantage |
|-----|-------------|---------------|
| Card Thief | Card puzzle, single player | Caps has multiplayer |
| Poker Heat | Hold'em focus | Caps has unique Omaha multi-board |
| Board Kings | Casual mobile | Caps has real card game depth |

---

## Unique Differentiators

### 1. Multi-board simultaneous evaluation
No other mainstream app offers 2–4 simultaneous Omaha boards with live probability tracking. This is the core mechanic that makes Caps unique.

### 2. Zero-friction multiplayer
- **Local WiFi:** No accounts, no internet — just be on the same network
- **Internet:** Share a code, join in 10 seconds
- **No sign-in required** to start playing immediately

### 3. Platform reach
Web version at caps.ftable.co.il means players can play on desktop/iPad without installing anything. Most poker apps are mobile-only.

### 4. WhatsApp AI assistant
Unique feature: WhatsApp number for bug reports + AI-powered responses in Hebrew. Rooted in the Israeli market.

---

## Target Market

**Primary:** Israeli poker enthusiasts, 20–40, play casually with friends
**Secondary:** Omaha poker players globally who want a training tool
**Device:** iPhone (primary), web browser (secondary)

---

## Competitive Gaps Caps Can Fill

1. **No Omaha multi-board app exists** — OFC is the closest but uses different rules
2. **Local WiFi multiplayer** — rare in mobile poker apps (most require internet + accounts)
3. **Hebrew UI/UX** — Israeli market underserved by international poker apps
4. **No real money = no regulatory risk** — can ship to any country without gambling licenses
