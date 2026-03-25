# VAMOS CAPS QUICK-CHECK
**Date:** 2026-03-21 14:45 IST
## DO NOT change code. ONLY check.

```
cd C:\Projects\Caps
git fetch origin main
gh run list --repo royea-beep/caps-poker --limit 5
git log --oneline -5 origin/main
git diff HEAD..origin/main --stat 2>/dev/null
```

If new commit exists:
```
git pull origin main
git log -1 --stat
git diff HEAD~1 --stat
```

If run still in progress:
```
gh run view $(gh run list --repo royea-beep/caps-poker --limit 1 --json databaseId -q '.[0].databaseId') --json status,conclusion -q '.status + " " + .conclusion'
```

Report: [run status] [new commit: yes/no] [files changed]

VAMOS CAPS QUICK-CHECK — END
