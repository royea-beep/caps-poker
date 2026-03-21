VAMOS CAPS BUGREPORTER-FIX 2026-03-18-1500

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## TASK A — Check BugReporter status

A1. Read components/BugReporter.tsx in full

A2. Check .env file for Supabase credentials:
    cat C:/Projects/Caps/.env

A3. Check if bug_reports table exists in Supabase:
    - Use the Supabase URL + anon key from .env
    - Run: curl -s "${SUPABASE_URL}/rest/v1/bug_reports?limit=10" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_ANON_KEY}"
    - If table doesn't exist → create it

A4. If table missing — create it via Supabase API or SQL:
    ```sql
    CREATE TABLE IF NOT EXISTS bug_reports (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      created_at timestamptz DEFAULT now(),
      version text,
      platform text,
      error_message text,
      error_stack text,
      screen text,
      device_info jsonb,
      extra jsonb
    );
    ```

A5. Check if SUPABASE_URL and SUPABASE_ANON_KEY are set as EAS secrets:
    eas secret:list 2>&1

A6. If missing — add them:
    eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "<value>"
    eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<value>"

A7. Check BugReporter.tsx — does it use the correct env var names?
    Should use: process.env.EXPO_PUBLIC_SUPABASE_URL
    Not: process.env.SUPABASE_URL (not exposed to client)

---

## TASK B — Verify BugReporter sends crash reports

B1. Add a test crash report send in BugReporter:
    On mount, send a test ping to Supabase:
    ```typescript
    // Test ping on mount
    useEffect(() => {
      sendReport({
        error_message: 'BugReporter test ping',
        screen: 'mount',
        version: Constants.expoConfig?.version ?? 'unknown',
        platform: Platform.OS,
      });
    }, []);
    ```

B2. Check Supabase table after next build to confirm reports arrive

B3. Remove the test ping after confirming it works (or keep it — useful for tracking installs)

---

## TASK C — Check recent crash reports

C1. Query bug_reports for anything after 2026-03-17:
    curl -s "${SUPABASE_URL}/rest/v1/bug_reports?created_at=gte.2026-03-17&order=created_at.desc&limit=20" \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}"

C2. Report ALL crash messages found

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — all pass
3. npx expo export --platform web
4. node scripts/fix-web-html.js
5. cd dist && vercel --prod --yes
6. git add -A && git commit -m "fix: BugReporter — Supabase table, env vars, test ping"
7. git push origin main
8. Report: is BugReporter working? Any crash reports found?

VAMOS CAPS BUGREPORTER-FIX — END
