VAMOS CAPS SUPABASE-GOOGLE-AUTH 2026-03-18-1830

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## TASK — Enable Google Auth in Supabase automatically

A1. Check how other projects enabled Google OAuth in Supabase:
    Look in C:/Projects/90soccer/ or C:/Projects/wingman/ for Supabase auth config
    Check for any scripts or patterns used there:
    find C:/Projects -name "*.py" -o -name "*.ts" -o -name "*.js" | xargs grep -l "supabase.*google\|google.*provider\|auth.*provider" 2>/dev/null | grep -v node_modules | head -10

A2. Check if there's a Supabase management API token saved anywhere:
    cat C:/Projects/Caps/.env
    cat C:/Projects/90soccer/.env 2>/dev/null
    cat C:/Projects/wingman/apps/mobile/.env 2>/dev/null
    find C:/Projects -name ".env*" | xargs grep -l "SUPABASE_SERVICE\|supabase_access_token\|SUPABASE_MANAGEMENT" 2>/dev/null | head -5

A3. Enable Google provider via Supabase Management API:
    ```bash
    # Get project ref from .env SUPABASE_URL
    # URL format: https://[project-ref].supabase.co
    
    curl -X PATCH \
      "https://api.supabase.com/v1/projects/{PROJECT_REF}/config/auth" \
      -H "Authorization: Bearer {SUPABASE_ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{
        "external_google_enabled": true,
        "external_google_client_id": "",
        "external_google_secret": ""
      }'
    ```
    Note: Google OAuth also needs client_id + secret from Google Cloud Console
    Check if these exist anywhere in the project files

A4. Check if Google OAuth credentials exist:
    grep -r "google.*client\|GOOGLE_CLIENT\|google_oauth" C:/Projects/Caps C:/Projects/90soccer C:/Projects/wingman 2>/dev/null | grep -v node_modules | head -10

A5. Run the Supabase migration for user_profiles table:
    cd C:/Projects/Caps
    npx supabase db push 2>&1
    OR use the REST API to create the table directly:
    curl -X POST "${SUPABASE_URL}/rest/v1/rpc/exec_sql" with the CREATE TABLE SQL

A6. Verify user_profiles table exists:
    curl -s "${SUPABASE_URL}/rest/v1/user_profiles?limit=1" \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}"

A7. Report:
    - Did Google provider get enabled?
    - Do Google OAuth credentials exist?
    - Is user_profiles table created?
    - What manual steps (if any) remain?

VAMOS CAPS SUPABASE-GOOGLE-AUTH — END
