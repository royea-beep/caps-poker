# LemonSqueezy Products Setup
## Store: 309460 (ftable) | ops map (not Caps runtime)

> **Caps billing SoT = RevenueCat IAP** — not LemonSqueezy.  
> This file is a **shared-store ops checklist** for sibling SaaS (KeyDrop / ExplainIt / PostPilot / analyzer).  
> Hygiene 2026-07-15: secrets scrubbed · webhook paths corrected (Sheet 50).

---

## Current State — placeholder variant risk

All 4 LS apps historically pointed at the SAME analyzer variants (ftable placeholders):
- Variant `1377967` = "Starter" (misused as Pro by KeyDrop, ExplainIt)
- Variant `1377974` = "Pro/Team" (misused across analyzer / KeyDrop / ExplainIt)
- Variant `1395653` = "Unlimited" (analyzer only)

**Problem:** Wrong billing amounts + wrong product names on checkout pages.

---

## Products to Create / align

### 1. KeyDrop — Encrypted one-time credential links
| Tier | Price | Billing | Env Var to Update |
|------|-------|---------|-------------------|
| Pro | $19/month | Monthly | `LEMONSQUEEZY_PRO_VARIANT_ID` in KeyDrop/.env |
| Team | $49/month | Monthly | `LEMONSQUEEZY_TEAM_VARIANT_ID` in KeyDrop/.env |

### 2. Analyzer — Product listing AI
| Tier | Price | Billing | Env Var to Update |
|------|-------|---------|-------------------|
| Pro | ₪79/month | Monthly | `LEMONSQUEEZY_VARIANT_PRO` in analyzer-standalone/.env.local |

> Note: Starter (`1377967`) and Unlimited (`1395653`) can stay if pricing is correct.  
> **IL live credit path = PayPlus IPN** (`/api/webhook/payplus`); LS = alt only.

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
7. Update the env var in the project `.env` file (never commit real values)
8. **Redeploy** the project for changes to take effect

---

## Webhooks (register in LS dashboard — paths MUST match app code)

| App | Webhook URL suffix | Secret env var (name only) |
|-----|--------------------|----------------------------|
| PostPilot | `/api/billing/webhook` | `LEMONSQUEEZY_WEBHOOK_SECRET` |
| ExplainIt | `/api/billing/webhook` | `LEMONSQUEEZY_WEBHOOK_SECRET` |
| KeyDrop | `/api/webhooks/lemonsqueezy` | `LEMONSQUEEZY_WEBHOOK_SECRET` |
| analyzer (LS alt) | `/api/billing/webhook` | `LEMONSQUEEZY_WEBHOOK_SECRET` |

**Do not use** `/api/lemonsqueezy/webhook` — that path does not exist on disk (stale).

Secrets live only in each app’s private env / vault — **never** paste signing secrets into docs, atlas, or git.

---

## API key

Shared store API key lives in each app’s private `.env` as `LEMONSQUEEZY_API_KEY` (name only). Rotate via LS dashboard if leaked historically.
