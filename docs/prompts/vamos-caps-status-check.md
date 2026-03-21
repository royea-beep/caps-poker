VAMOS CAPS STATUS-CHECK

Read MEMORY.md fully before anything else.

Standing Orders:
- Try ALL actions autonomously first
- Check C:/Projects/ for any credentials needed
- Only escalate ONE specific question if truly blocked
- Never give the user a list of commands to run

---

## TASK — Full Status Report

A1. Read MEMORY.md — report the current sprint number and last recorded state

A2. Run:
    cd C:/Projects/Caps
    git log --oneline -10
    npx tsc --noEmit 2>&1
    npx jest --silent 2>&1

A3. Check dist/ folder:
    - Does C:\Projects\Caps\dist\ exist?
    - What files are in it?
    - Check dist\index.html — how is the JS bundle loaded? Does the script tag have type="module"?

A4. Check web deployment:
    curl -s -o /dev/null -w "%{http_code}" http://caps.ftable.co.il 2>&1
    curl -sk -o /dev/null -w "%{http_code}" https://caps.ftable.co.il 2>&1

A5. Check app.json — what is the current "web" config?

A6. Report everything in a clear table:
    - Last git commit + message
    - TypeScript status
    - Test status (X/43)
    - dist/ exists? (yes/no)
    - index.html script tag has type="module"? (yes/no)
    - http://caps.ftable.co.il HTTP status
    - https://caps.ftable.co.il HTTPS status
    - Any open issues found in MEMORY.md

Do NOT fix anything yet. Just report.

VAMOS CAPS STATUS-CHECK — END
