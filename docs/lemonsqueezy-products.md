# LemonSqueezy Products Setup
## Store: 309460 (ftable) | 2026-03-19

---

## Current State — All Projects Using PLACEHOLDER Variants

All 4 projects currently point to the SAME analyzer variants (ftable placeholders):
- Variant 1377967 = "Starter" (being used as Pro by KeyDrop, ExplainIt)
- Variant 1377974 = "Pro/Team" (being used as Pro by analyzer, Team by KeyDrop/ExplainIt)
- Variant 1395653 = "Unlimited" (analyzer only)

**Problem:** Wrong billing amounts + wrong product names on checkout pages.

---

## Products to Create

### 1. KeyDrop — Encrypted one-time credential links
| Tier | Price | Billing | Env Var to Update |
|------|-------|---------|-------------------|
| Pro | $19/month | Monthly | `LEMONSQUEEZY_PRO_VARIANT_ID` in KeyDrop/.env |
| Team | $49/month | Monthly | `LEMONSQUEEZY_TEAM_VARIANT_ID` in KeyDrop/.env |

### 2. Analyzer — Product listing AI
| Tier | Price | Billing | Env Var to Update |
|------|-------|---------|-------------------|
| Pro | ₪79/month | Monthly | `LEMONSQUEEZY_VARIANT_PRO` in analyzer-standalone/.env.local |

> Note: Starter (1377967) and Unlimited (1395653) variants can stay as-is if pricing is correct.

### 3. ExplainIt — Auto explainer video generator
| Tier | Price | Billing | Env Var to Update |
|------|-------|---------|-------------------|
| Pro | $19/month | Monthly | `LEMONSQUEEZY_PRO_VARIANT_ID` in ExplainIt/.env.local |
| Team | $49/month | Monthly | `LEMONSQUEEZY_TEAM_VARIANT_ID` in ExplainIt/.env.local |

### 4. PostPilot — Social media scheduler
PostPilot has no variant IDs in .env — check PostPilot/.env for billing setup.

---

## Steps to Create Each Product

1. Go to [dashboard.lemonsqueezy.com](https://dashboard.lemonsqueezy.com)
2. Store: **ftable** (309460)
3. Products → **New Product**
4. Set product name, description, pricing
5. Under **Variants** → set price + billing period (Monthly)
6. Save → copy the **Variant ID** from the URL or API
7. Update the env var in the project `.env` file
8. **Redeploy** the project for changes to take effect

---

## Webhook (already configured)
- Webhook secret: `8298381b5ea60cc961b58603` (analyzer, KeyDrop)
- PostPilot webhook secret: `5a15d6059d6563f2f46c6a7a804ad9f6` (different)
- Endpoint per project: `/api/lemonsqueezy/webhook`

---

## API Key (shared across all projects)
Same key in all `.env` files — already working, no changes needed.
