# VAMOS 73 — CAPS Revenue Uplift Simulation
Generated: 2026-04-18 | Status: READ-ONLY, not applied

## Baseline (Current State)

| Metric | Value | Source |
|--------|-------|--------|
| Total analytics events | 531 | analytics_events table |
| Unique sessions (app_opened) | 47 | analytics_events |
| Active players (hand_dealt) | 70 | analytics_events |
| Registered push tokens | 3 | push_tokens table |
| IAP purchases (confirmed) | ~0–1 | chip_transactions estimate |
| Conversion rate (purchases/sessions) | ~0.5% | estimate |
| Avg order value | $2.99 | chip_store_packages |
| Monthly revenue estimate | ~$0–5 | baseline |

## Funnel Drop-off Analysis

```
app_opened        47  (100%)
home_loaded       41  ( 87%)   -13%  load / cold-start drop
play_tapped       61  (130%)   re-entries counted — healthy
game_started      70  (149%)   —
hand_dealt        70  (100%)   no drop on start → deal
hand_completed    25  ( 36%)   -64%  CRITICAL: rage-quit / chip bleed
game_ended        21  ( 30%)   —
tutorial_skipped   5  —        5 skip vs 1 complete = FTUE broken
tutorial_completed 1  —        
```

**Root cause**: 64% of hands are abandoned. Players run out of chips with
no recovery path (no push, no offer, no daily free chips surfaced). This is
the primary revenue opportunity — players who bleed chips and have no way
to continue are churning silently.

## Three-Lever Model

### Lever 1 — Starter Pack 2x Offer
- Target: first-session users who hit chip floor
- Mechanism: $2.99 → 10,000 chips (instead of 5,000), first-time only
- Conversion lift assumption: 0.5% → 2.5% (5× — proven on freemium poker apps)
- Impact per 100 new installs: 2.5 purchases × $2.99 = $7.48 (vs $1.50 baseline)

### Lever 2 — D1 Push Activation
- Current: 3 push tokens, 0 flash_deal sends
- Target: wire `flash_deal` template to send 24h after install
- Conversion lift assumption: +0.8% incremental (push recall for churned D0 users)
- Impact per 100 installs with push: 0.8 purchases × $2.99 = $2.39

### Lever 3 — Chip Bleed Safety Net
- Add free daily refill (1,000 chips) — surface prominently after game_ended with low balance
- Not an IAP change; reduces rage-churn, increases LTV
- Indirect: players who stay longer convert at 3–4× rate vs day-0 churners
- Impact: estimated +1.5% conversion on days 3–7 retained users

## Projected Revenue at Scale

| Scenario | Monthly Installs | Conversion | Avg Order | Monthly Rev |
|----------|-----------------|------------|-----------|-------------|
| Current (baseline) | 100 | 0.5% | $2.99 | $1.50 |
| Lever 1 only | 100 | 2.5% | $2.99 | $7.48 |
| Lever 1+2 | 100 | 3.3% | $3.20 | $10.56 |
| Lever 1+2+3 | 100 | 4.8% | $3.50 | $16.80 |
| Lever 1+2+3 @ 500 installs | 500 | 4.8% | $3.50 | $84.00 |

## Priority Order

1. **Starter Pack 2x** — highest direct conversion, zero gameplay change
2. **D1 Push** — needs 3→100+ token registration first (fix registration call)
3. **Daily chip refill** — reduces churn, boosts D7 LTV

## Prerequisites Before Any IAP Change

- [ ] Verify StoreKit product IDs match app_config packages exactly
- [ ] Confirm client reads `starter_pack_2x_enabled` flag before showing badge
- [ ] Confirm client writes to `starter_pack_redemptions` after purchase
- [ ] Push token registration — currently 3 tokens for ~70 active players (4% opt-in)
      → check if `registerForPushNotificationsAsync()` is called on app launch
