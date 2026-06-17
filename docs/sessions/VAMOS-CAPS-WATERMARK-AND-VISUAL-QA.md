# VAMOS CAPS CAPS-WATERMARK-AND-VISUAL-QA
**Date:** 2026-04-27 IST | **Priority:** 2 tasks — fix watermark + install visual QA infrastructure

## CONTEXT
v2.7.0 (DB:471 / EAS:328) live with all UX fixes from earlier today. ONE issue remains visible in screenshot 5:39: "CAPS POKER" watermark still bleeds through behind the boards. Previous VAMOS removed 2 watermark blocks but more exist.

After fixing the watermark, install visual-QA infrastructure (Playwright screenshot validation) so the bot has eyes — every push gets compared against baseline screenshots. This prevents the kind of "Done" reports that don't actually fix the visual issue.

## RULES
- ❌ NEVER edit Card.tsx
- ❌ NEVER touch native config (app.json/package.json/eas.json)
- ✅ Show grep output BEFORE making changes
- ✅ Test locally with `npm run web` after changes
- ✅ Push OTA to BOTH channels (production + testflight)

---

## PART A — Watermark removal (final pass)

### TASK A1 — Find ALL watermark sources

```bash
cd C:/Projects/POKER/Caps

# Find every reference to CAPS POKER text or watermark in render code
grep -rn "CAPS POKER\|capsLogo\|caps-watermark\|watermark\|wordmark\|brandMark" --include="*.tsx" --include="*.ts" 2>/dev/null

# Also check for any background image with the logo
grep -rn "background.*logo\|logo.*background" --include="*.tsx" 2>/dev/null

# Check theme/style files
grep -rn "CAPS\|POKER" components/themes/*.ts components/themes/*.tsx 2>/dev/null
```

**Report ALL matches.** Don't filter — show me everything. The previous VAMOS removed only 2 blocks in app/game.tsx but the watermark still appears in screenshot. There must be another source.

### TASK A2 — Remove all instances

For each match found in A1 that renders text/image of "CAPS POKER" inside the game screen tree:
- Wrap in comment: `{/* watermark removed */}`
- OR delete the JSX entirely if it's truly unused

**Specifically check:**
- `app/game.tsx` — any remaining instances beyond the 2 already removed
- `components/Board.tsx` — could have its own background watermark
- `components/BoardArrangement.tsx` — could render branding
- `components/Background.tsx` if exists
- Theme files — sometimes watermarks are set via theme background image

### TASK A3 — Verify

After removing, search again to confirm zero references in active render code:
```bash
grep -rn "CAPS POKER" components/ app/ --include="*.tsx" 2>/dev/null
# Should return either zero matches OR only the home screen logo (which is expected and fine)
```

---

## PART B — Install Playwright visual QA

### TASK B1 — Install Playwright

```bash
npm install --save-dev @playwright/test playwright
npx playwright install chromium
```

### TASK B2 — Create baseline screenshot directory

```bash
mkdir -p tests/visual
mkdir -p tests/visual/baselines
```

### TASK B3 — Create the test file

Create `tests/visual/game-screen.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

// Visual regression tests for CAPS Poker key screens.
// Run locally before push: npx playwright test
// First run creates baselines. Future runs compare against baselines.

test.describe('CAPS Poker key screens', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8081');
    // Wait for the app to fully render
    await page.waitForLoadState('networkidle');
  });

  test('home screen renders without unexpected changes', async ({ page }) => {
    await expect(page).toHaveScreenshot('home.png', { 
      maxDiffPixels: 100,
      fullPage: true 
    });
  });

  test('game screen 2P (4 boards, 16 cards)', async ({ page }) => {
    // Navigate to 2P game
    await page.click('text=שחק');
    await page.click('text=2');
    await page.waitForTimeout(2000);
    
    await expect(page).toHaveScreenshot('game-2p.png', { 
      maxDiffPixels: 200,
      fullPage: true 
    });
  });

  test('settings screen', async ({ page }) => {
    await page.click('text=פרופיל');
    await page.click('text=הגדרות');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('settings.png', { 
      maxDiffPixels: 100,
      fullPage: true 
    });
  });
});
```

### TASK B4 — Create playwright.config.ts at project root (if not exists)

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  timeout: 30 * 1000,
  expect: {
    toHaveScreenshot: { maxDiffPixels: 100 },
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8081',
    viewport: { width: 414, height: 896 }, // iPhone 11 Pro size
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  webServer: {
    command: 'npm run web',
    url: 'http://localhost:8081',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
```

### TASK B5 — Add npm script

In `package.json` scripts section add:
```json
"visual-qa": "playwright test",
"visual-qa:update": "playwright test --update-snapshots"
```

### TASK B6 — Generate baselines

```bash
# First-time baseline generation
npx playwright test --update-snapshots
```

This creates the initial baseline screenshots in `tests/visual/baselines/`.
After this, every `npx playwright test` run will compare current state vs baseline and fail if there's an unintended visual change.

### TASK B7 — Document in CLAUDE.md

Append to `CLAUDE.md`:

```markdown

## Visual QA (NEW — added Apr 27)

Before any UI change, run:
```bash
npm run visual-qa
```

If the test fails, the diff is in `test-results/` showing exact pixel differences.
After intentional UI changes, update baselines:
```bash
npm run visual-qa:update
git add tests/visual/baselines/
git commit -m "chore: update visual QA baselines after [reason]"
```

This prevents accidentally breaking the UI without noticing.
```

---

## DELIVERY

```bash
# TypeScript check
npx tsc --noEmit 2>&1 | tail -5

# Run visual QA to make sure it works (will create baselines first time)
npx playwright test --update-snapshots 2>&1 | tail -20

git add -A
git commit -m "fix(ux): final watermark removal + add Playwright visual QA infrastructure

- Removed remaining CAPS POKER watermark instances (game screen, board components)
- Installed @playwright/test for visual regression testing
- Created tests/visual/game-screen.spec.ts with home/game/settings tests
- Generated baseline screenshots
- Added npm scripts: visual-qa, visual-qa:update
- Updated CLAUDE.md with QA workflow

This gives the bot eyes — future UI changes won't silently regress."

git push origin main

# Push OTA to both channels
eas update --branch production --message "Watermark removal final + visual QA setup"
eas update --branch testflight --message "Watermark removal final + visual QA setup"
```

Update DB:
```sql
INSERT INTO deploy_log (type, version, build_number, message, deployed_at)
VALUES ('ota', '2.7.0', '328', 'Watermark final removal + Playwright visual QA infrastructure (commit [SHA])', NOW());
```

---

## AUDIT FORMAT

```
PART A — WATERMARK
  A1 grep results: [paste full output, even if many matches]
  A2 files modified: [list]
  A2 BEFORE/AFTER for each: [show actual lines]
  A3 final grep: [zero matches in active render code? confirm]

PART B — PLAYWRIGHT
  B1 install: ✅/❌
  B2 directories created: ✅/❌
  B3 test file at tests/visual/game-screen.spec.ts: ✅/❌
  B4 playwright.config.ts: ✅/❌ (created or already existed?)
  B5 npm scripts added: ✅/❌
  B6 baselines generated: ✅ (count of files) / ❌ (error)
  B7 CLAUDE.md updated: ✅/❌

DELIVERY:
  TypeScript clean: ✅/❌
  Visual-qa first run: ✅ (passes after baselines) / ⚠️ (errors — explain)
  Commit SHA: [hash]
  production update group: [hash]
  testflight update group: [hash]
```

If anything fails — STOP, report, don't push. Better to fix than to add broken infrastructure.

Yes, allow all edits.

VAMOS CAPS CAPS-WATERMARK-AND-VISUAL-QA — END
