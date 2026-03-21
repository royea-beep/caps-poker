VAMOS CAPS RECOVERY 2026-03-18-1730

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## SITUATION
Terminal crashed. Multiple Claude Bot sessions were open.
Need to understand current state and continue.

## TASK A — Assess current state

A1. Check git log — what was the last commit?
    git log --oneline -10

A2. Check if there are uncommitted changes:
    git status --short

A3. Check current version:
    cat app.json | grep version

A4. Check if web is up to date:
    curl -sk https://caps.ftable.co.il/index.html | grep "index-" | head -1

A5. Check latest CI build:
    gh run list --repo royea-beep/caps-poker --limit 5

A6. Check if any of the recent prompts were partially applied:
    - Was vamos-caps-reveal-drama-2026-03-18-1700.md applied?
    - Was vamos-caps-hand-size-fix-2026-03-18-1620.md applied?
    Check git log for commit messages mentioning "reveal-drama" or "hand-size"

A7. Report EXACTLY:
    - Last commit hash + message
    - Any uncommitted changes
    - Current version
    - Is web live and up to date?
    - Which prompts were completed, which were not

---

## TASK B — Continue from where we left off

B1. If reveal-drama was NOT applied:
    Apply it now:
    - FLOP/TURN/RIVER countdown 3...2...1...
    - Win probability after each street
    - Dramatic timing

B2. If any files have merge conflicts or partial changes:
    Fix them cleanly

B3. npx tsc --noEmit — 0 errors
B4. npx jest --silent — all pass

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — all pass
3. npx expo export --platform web
4. node scripts/fix-web-html.js
5. cd dist && vercel --prod --yes
6. git add -A && git commit -m "recovery: resume after terminal crash"
7. git push origin main
8. Report full status

VAMOS CAPS RECOVERY — END
