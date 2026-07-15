# ARCHIVED note — lemonsqueezy-products.md (pre-hygiene)

Archived: 2026-07-15
Reason: tracked doc had wrong webhook path `/api/lemonsqueezy/webhook` and embedded signing-secret values.

Action taken: live `docs/lemonsqueezy-products.md` scrubbed + paths corrected to Sheet 50 matrix.
Secrets: **not** preserved here (would re-leak). Rotate `LEMONSQUEEZY_WEBHOOK_SECRET` in each app env if those values were ever exposed outside vault.

See: `_empire/atlas/50-deep-ls-payplus-billing-webhooks.md` Part F.
