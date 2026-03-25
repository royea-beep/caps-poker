# VAMOS CAPS QUICK-CHECK-FIX
**Date:** 2026-03-21 14:08 IST

## DO NOT change code. ONLY check and report.

```
cd C:\Projects\Caps
git fetch origin main
gh run list --repo royea-beep/caps-poker --limit 5
git log --oneline -5 origin/main
git log --oneline -5
git diff HEAD..origin/main --stat 2>/dev/null
```

Report:
```
Last GitHub Actions run: [ID] — [STATUS] — [time]
Last commit on origin/main: [hash] [message]
Last local commit: [hash] [message]
New files changed: [list or none]
```

If there IS a new commit from the bot:
```
git pull origin main
git log -1 --stat
```
Show what files changed.

If run FAILED — show the error:
```
gh run view [RUN_ID] --log-failed 2>&1 | tail -30
```

VAMOS CAPS QUICK-CHECK-FIX — END
