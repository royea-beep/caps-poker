# Caps Poker — Iron Rules
# Read this file at the start of EVERY session.
# Auto-generated: 2026-03-21 IST

## UNIVERSAL RULES (all projects)

### Git
- NEVER commit directly to main/master without tsc check
- ALWAYS: npx tsc --noEmit → build → git commit → git push
- NEVER delete files — archive with reason in commit message
- Commit message format: "feat|fix|chore|docs: description"

### Code Quality
- TypeScript: 0 errors required before any commit
- NEVER leave TODO comments in committed code
- NEVER hardcode credentials, API keys, or secrets
- ALWAYS use environment variables for external services

### Database (Supabase)
- NEVER DROP TABLE or TRUNCATE without checking row count first
- NEVER expose service_role key in client-side code
- ALWAYS enable RLS on new tables
- ALWAYS use ALTER TABLE — never recreate tables with data

### Payments
- Israeli merchant = Payplus ONLY (never Stripe, never LemonSqueezy)
- import from shared-utils/payplus

### Deployment
- NEVER deploy without successful build first

## IRON RULE: Responsive Design
# Added: 2026-03-21 | Reason: Recurring bug across all projects

FORBIDDEN:
  w-[400px], h-[600px], style={{ width: "Xpx" }}, text-[18px] on layout

REQUIRED:
  w-full, max-w-*, flex-wrap, text-base sm:text-lg

TEST BREAKPOINTS: 320px / 390px / 768px / 1280px

QUICK AUDIT:
  grep -rn "w-\[" src --include="*.tsx"
  grep -rn "style={{ width" src --include="*.tsx"

## MOBILE RULES (Capacitor/iOS/Android)
- NEVER touch p12/certificates manually — EAS remote only
- NEVER push to TestFlight without explicit "אשר" from Roye
- ALWAYS use PlistBuddy for version bumps, never manual edit
- Safe areas: pb-safe pt-safe on all screen containers
- Bundle IDs are locked — never change
- Test on real device before TestFlight push

## PROJECT: Caps Poker
- Stack: React Native + Expo only
- iOS portrait only
- Omaha hand evaluation (no Texas Hold'em)
- No backend (Phase 1), Supabase Realtime (Phase 2)
- Theme: Central Perk (coffee-inspired UI)
- Web: caps.ftable.co.il — output: "single" + type="module"
- Add project-specific rules below
