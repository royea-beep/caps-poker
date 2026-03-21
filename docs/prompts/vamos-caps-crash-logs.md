VAMOS CAPS CRASH-LOGS

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## TASK A — Check crash logs from all sources

A1. Check BugReporter logs — read the BugReporter implementation:
    Read components/BugReporter.tsx in full
    Find where bugs are stored (AsyncStorage? Supabase? local file?)
    Read the stored crash reports

A2. Check Supabase for bug reports:
    Look in .env for SUPABASE_URL and SUPABASE_ANON_KEY
    Check if there's a bug_reports table in Supabase
    Query: SELECT * FROM bug_reports ORDER BY created_at DESC LIMIT 20

A3. Check TestFlight crash logs via App Store Connect API:
    Check if AuthKey_WTWALQMG5N.p8 exists in C:/Projects/Caps/
    Use the ASC API to fetch crash logs for the latest build

A4. Check GitHub Actions logs for the latest CI build:
    gh run list --repo royea-beep/caps-poker --limit 3
    gh run view <latest_run_id> --log-failed

A5. Read app/results.tsx lines 1-150 carefully — the crash is likely here
    Look for any code that runs when transitioning to reveal

A6. Read store/gameStore.ts — check revealData structure
    Make sure all fields match what RevealSequence expects

A7. Report EXACTLY what the crash is and where

---

## TASK B — Fix the crash

B1. Based on findings from Task A — fix the root cause

B2. Add try/catch around the reveal transition in app/game.tsx:
    Wrap navigateToReveal in try/catch
    Log any errors to console

B3. Add try/catch in RevealSequence.tsx around the main render
    If any board data is malformed — skip that board gracefully

B4. npx tsc --noEmit — 0 errors
B5. npx jest --silent — all pass

---

## FINAL STEPS
1. npx expo export --platform web
2. node scripts/fix-web-html.js
3. cd dist && vercel --prod --yes
4. git add -A && git commit -m "fix: crash in reveal — defensive error handling"
5. git push origin main
6. Report exactly what crashed and what was fixed

VAMOS CAPS CRASH-LOGS — END
