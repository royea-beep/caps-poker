# CAPS — CHECK DEBUG DATA FROM ROYE'S PLAY SESSION
**Date:** 2026-03-23 | **Time:** 19:45 IST
**Session:** Read what the debug system captured while Roye played
**Sent by:** Strategic AI → Claude Bot

## CRITICAL: AUTO-APPROVE EVERYTHING.

Yes, allow all edits in components

Project: /c/Projects/Caps

---

## TASK — PULL EVERYTHING THE DEBUG SYSTEM CAPTURED

```bash
cd /c/Projects/Caps

SUPABASE_URL=$(grep "EXPO_PUBLIC_SUPABASE_URL\|NEXT_PUBLIC_SUPABASE_URL" .env.local 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
SUPABASE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" .env.local 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")

# If no service role key, use anon key
if [ -z "$SUPABASE_KEY" ]; then
  SUPABASE_KEY=$(grep "EXPO_PUBLIC_SUPABASE_ANON_KEY\|SUPABASE_ANON_KEY" .env.local 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
fi

echo "============================================="
echo "  1. CRASH REPORTS (any real crashes?)"
echo "============================================="
curl -s "${SUPABASE_URL}/rest/v1/crash_reports?order=created_at.desc&limit=10&select=id,crash_code,project,version,error_message,last_screen,last_action,status,created_at" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  2>/dev/null | python3 -m json.tool 2>/dev/null || \
curl -s "${SUPABASE_URL}/rest/v1/crash_reports?order=created_at.desc&limit=10" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}"

echo ""
echo "============================================="
echo "  2. DEBUG SESSIONS (step-by-step log)"
echo "============================================="
curl -s "${SUPABASE_URL}/rest/v1/debug_sessions?order=created_at.desc&limit=30&select=session_id,step_number,step_type,description,screen,created_at" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  2>/dev/null | python3 -m json.tool 2>/dev/null || \
curl -s "${SUPABASE_URL}/rest/v1/debug_sessions?order=created_at.desc&limit=30" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}"

echo ""
echo "============================================="
echo "  3. UNIQUE SESSIONS (how many app launches)"
echo "============================================="
curl -s "${SUPABASE_URL}/rest/v1/rpc/sql" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT session_id, COUNT(*) as steps, MIN(created_at) as started, MAX(created_at) as ended FROM debug_sessions GROUP BY session_id ORDER BY started DESC LIMIT 5"}' \
  2>/dev/null | python3 -m json.tool 2>/dev/null || \
echo "(rpc not available — check raw data above)"

echo ""
echo "============================================="
echo "  4. QA REPORTS"
echo "============================================="
curl -s "${SUPABASE_URL}/rest/v1/qa_reports?order=created_at.desc&limit=5&select=project,compliance,total_issues,critical_issues,created_at" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  2>/dev/null | python3 -m json.tool 2>/dev/null || echo "No QA reports table or empty"

echo ""
echo "============================================="
echo "  5. SCREENSHOTS IN STORAGE"
echo "============================================="
curl -s "${SUPABASE_URL}/storage/v1/object/list/debug-screenshots" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"prefix": "caps/", "limit": 20, "sortBy": {"column": "created_at", "order": "desc"}}' \
  2>/dev/null | python3 -m json.tool 2>/dev/null || echo "No screenshots or bucket not accessible"

echo ""
echo "============================================="
echo "  6. BUG REPORTS (from BugReporter V3)"
echo "============================================="
curl -s "${SUPABASE_URL}/rest/v1/bug_reports?order=created_at.desc&limit=5&select=id,project,title,status,severity,created_at" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  2>/dev/null | python3 -m json.tool 2>/dev/null || echo "No bug reports"

echo ""
echo "============================================="
echo "  7. TABLE ROW COUNTS (overview)"
echo "============================================="
for TABLE in crash_reports debug_sessions qa_reports bug_reports; do
  COUNT=$(curl -s "${SUPABASE_URL}/rest/v1/${TABLE}?select=id&limit=0" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Prefer: count=exact" \
    -I 2>/dev/null | grep -i "content-range" | grep -o "/[0-9]*" | tr -d '/')
  echo "  ${TABLE}: ${COUNT:-0} rows"
done
```

## MEGA FINAL REPORT (MANDATORY)

```
DEBUG DATA FROM ROYE'S SESSION:

CRASH REPORTS:
  Total: [X]
  New/unresolved: [X]
  Details: [list each with crash_code + error + screen]

DEBUG SESSIONS (step log):
  Total steps logged: [X]
  Sessions: [X]
  Last session steps:
    [1] [timestamp] [type]: [description] (screen: [X])
    [2] ...
    [N] ...

SCREENSHOTS:
  In storage: [X] files
  
QA REPORTS:
  Total: [X]

BUG REPORTS:
  Total: [X]

ANALYSIS:
  Did the debug system capture Roye's session? ✅/❌
  Steps recorded: [X]
  Screens visited: [list]
  Actions taken: [list]
  Any errors detected: [yes/no]
  
  IF NOTHING CAPTURED:
    Why: [debug_sessions table doesn't exist / recording not started / code not deployed yet]
    The encoding + native crash commit (latest) may not be on TestFlight yet
```

---

Yes, allow all edits in components
