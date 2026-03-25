# VAMOS CAPS WHATSAPP-SMART-APPROVAL
**Date:** 2026-03-21 07:49 IST
**Priority:** 🔴 Two missions — upgrade bot flow + fix real bug

## ROLE
Senior backend engineer + product designer

## FIRST ACTIONS
```
Read C:\Projects\Caps\MEMORY.md
cat C:\Projects\Caps\supabase\functions\whatsapp-bot-handler\index.ts
```

Check accumulated fixes since last build:
```
cd C:\Projects\Caps
git log --oneline HEAD...$(git log --oneline --all | grep "build\|deploy\|TestFlight" | head -1 | awk '{print $1}') 2>/dev/null
git log --oneline -20
```

## CONTEXT
Current flow:
- User sends bug → bot generates plan → user replies 1 (approve) or 2 (cancel)
- Approve = triggers GitHub Actions → build + deploy always

Problems:
1. Every small fix triggers a full EAS build ($$$, 15 min wait, new TestFlight version)
2. No way to batch small fixes — accumulate 3-5 and then deploy
3. Bot doesn't know if this is a critical fix or a minor tweak
4. No tracking of how many fixes are pending since last deploy

## MISSION

═══════════════════════════════════════════════
AGENT 1 — Smart Approval Flow
═══════════════════════════════════════════════

Update `supabase/functions/whatsapp-bot-handler/index.ts`:

### A. New Response Format

After Claude generates a plan, the bot should also assess severity:
- Add to the Claude system prompt: "Also assess severity: CRITICAL (breaks gameplay/crashes), MEDIUM (UX issue, visual bug), LOW (nice-to-have, polish)"

The response message should now show:

```
🐞 סוג: באג | פרויקט: caps-poker
חומרה: [CRITICAL/MEDIUM/LOW]

[summary]

תוכנית:
1. ...
2. ...

קבצים: ...
מאמץ: ...

═══════════════════
📊 באגים ממתינים מאז הגרסה האחרונה: [N]
═══════════════════

השב 1️⃣ לתיקון בלבד (commit, בלי build חדש)
השב 2️⃣ לתיקון + build חדש ל-TestFlight
השב 3️⃣ לביטול ❌

[המלצת הבוט: X — כי ...]
```

### B. Bot Recommendation Logic

The bot should recommend based on:

```
IF severity === CRITICAL:
  recommend = 2 (fix + build)
  reason = "באג קריטי — מומלץ לעדכן גרסה מיד"

ELSE IF pending_fixes >= 5:
  recommend = 2 (fix + build)
  reason = "כבר [N] תיקונים ממתינים — מומלץ לעדכן גרסה"

ELSE IF pending_fixes >= 3 AND severity === MEDIUM:
  recommend = 2 (fix + build)
  reason = "[N] תיקונים + באג בינוני — שווה לעדכן"

ELSE:
  recommend = 1 (fix only)
  reason = "תיקון קטן — שווה לצבור עוד לפני build חדש"
```

### C. Track Pending Fixes

Add to `whatsapp_sessions` table (or create new table `deploy_tracker`):

```sql
-- Option: use existing whatsapp_sessions
-- Count sessions with status='fix_committed' (new status) since last 'deployed'

-- OR create new tracking:
CREATE TABLE IF NOT EXISTS deploy_tracker (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project text NOT NULL DEFAULT 'caps-poker',
  fix_summary text NOT NULL,
  severity text NOT NULL,
  session_id uuid REFERENCES whatsapp_sessions(id),
  committed_at timestamptz DEFAULT now(),
  deployed_at timestamptz DEFAULT NULL
);
```

When user replies **1** (fix only):
- Trigger GitHub Actions with event type `claude-fix-no-build`
- Store in deploy_tracker: status = committed, deployed_at = NULL
- Reply: "✅ תיקון בביצוע. לא עולה גרסה. (סה״כ [N] תיקונים ממתינים)"

When user replies **2** (fix + build):
- Trigger GitHub Actions with event type `claude-fix-and-deploy`
- Mark ALL pending deploy_tracker rows: deployed_at = now()
- Reply: "🚀 תיקון + build חדש ל-TestFlight! ([N] תיקונים עולים בגרסה הזאת)"

When user replies **3** (cancel):
- Same as current 2/cancel behavior
- Reply: "❌ בוטל"

### D. GitHub Actions Events

The CI workflow needs to handle two event types:

For `claude-fix-no-build`:
- Run the fix
- git commit + push
- Do NOT trigger EAS build

For `claude-fix-and-deploy`:
- Run the fix
- git commit + push
- Trigger EAS build + submit to TestFlight

Check if the current `.github/workflows/` can handle this:
```
cat C:\Projects\Caps\.github\workflows\*.yml
```

If needed, update the workflow to check `github.event.action` and skip/run the build step accordingly.

═══════════════════════════════════════════════
AGENT 2 — Supabase Migration
═══════════════════════════════════════════════

Create migration for deploy_tracker:

```
cd C:\Projects\Caps
npx supabase migration new deploy_tracker
```

Write the SQL:
```sql
CREATE TABLE IF NOT EXISTS deploy_tracker (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project text NOT NULL DEFAULT 'caps-poker',
  fix_summary text NOT NULL,
  severity text CHECK (severity IN ('CRITICAL', 'MEDIUM', 'LOW')) NOT NULL,
  session_id uuid,
  committed_at timestamptz DEFAULT now(),
  deployed_at timestamptz DEFAULT NULL
);

-- RLS
ALTER TABLE deploy_tracker ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON deploy_tracker
  FOR ALL USING (auth.role() = 'service_role');

-- Index for counting pending
CREATE INDEX idx_deploy_tracker_pending 
  ON deploy_tracker (project, deployed_at) 
  WHERE deployed_at IS NULL;
```

Apply:
```
npx supabase db push
```

═══════════════════════════════════════════════
AGENT 3 — Deploy Updated Edge Function
═══════════════════════════════════════════════

```
cd C:\Projects\Caps
npx supabase functions deploy whatsapp-bot-handler --no-verify-jwt
```

Verify:
```
curl -s -o /dev/null -w "%{http_code}" https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler
```
Should return 405 (alive).

═══════════════════════════════════════════════
AGENT 4 — Test with the REAL Bug
═══════════════════════════════════════════════

Now test with the actual bug that was reported:

The Pro Quotes feature (ProQuoteBanner.tsx) is TEXT ONLY — there are no sound files.
But the system prompt might make Claude think there should be audio.

Simulate: if someone sends "קאפס — הסאונד של משפטי השחקנים לא עובד"

The CORRECT response should be:
- Severity: LOW (pro quotes are text only by design — no sound expected)
- Plan: verify ProQuoteBanner.tsx is text-only, add a "coming soon" note or remove any sound references
- NOT: "check SoundManager.ts and audio files" (that was the wrong plan last time)

If the system prompt leads Claude astray, adjust the prompt to include:
"Check the ACTUAL codebase before assuming features exist. If a feature is text-only, don't assume it has audio."

═══════════════════════════════════════════════
AGENT 5 — Finish
═══════════════════════════════════════════════

```
F1. npx tsc --noEmit — 0 errors
F2. npx jest --forceExit — 126+ pass
F3. git add -A && git commit -m "feat: WhatsApp bot smart approval — fix-only vs fix+deploy, severity, pending tracker"
F4. git push origin main
F5. Update MEMORY.md
```

## SUCCESS CRITERIA
- ✅ Bot shows 3 options (fix only / fix+build / cancel)
- ✅ Bot shows severity (CRITICAL/MEDIUM/LOW)
- ✅ Bot shows pending fix count since last deploy
- ✅ Bot recommends which option based on severity + pending count
- ✅ deploy_tracker table created in Supabase
- ✅ GitHub Actions handles both event types
- ✅ Edge Function redeployed
- ✅ All tests pass, 0 TS errors

## DO NOT
- Do NOT change game code (app/, components/, utils/)
- Do NOT trigger a build
- Do NOT touch Twilio webhook (it's set)

VAMOS CAPS WHATSAPP-SMART-APPROVAL — END
