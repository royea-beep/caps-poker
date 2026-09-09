> ⚠️ 2026-09-06 — a live-shaped Google API key was written out in full in this file and has
> been public in this repository's history since 2026-03-21. It is replaced above with an
> environment-variable reference. The key itself tested DEAD on 2026-09-06 (Google returned
> `API_KEY_INVALID`, not merely a disabled API), so there is nothing to revoke — but it is
> still in git history and removing it here only prevents the next leak.

# VAMOS CAPS CHECK-BUG-REPORT
**Date:** 2026-03-21 09:43 IST
**Priority:** Check if in-app bug report arrived + process it

## ROLE
QA engineer — trace the bug report pipeline

## FIRST ACTIONS
```
Read C:\Projects\Caps\MEMORY.md
```

## STEP 1 — Check where bug reports land

```
cat C:\Projects\Caps\components\BugReporter.tsx 2>/dev/null | head -50
grep -rn "DRIVE\|drive\|bug.report\|upload" C:\Projects\Caps\components\BugReporter.tsx 2>/dev/null
grep -rn "DRIVE_FOLDER\|PROJECTS.DEBUG" C:\Projects\Caps\.env 2>/dev/null
grep -rn "bug-report\|bug_report" C:\Projects\Caps\utils\ 2>/dev/null
```

Check Drive folders:
```
cat C:\Projects\DRIVE_FOLDERS.md 2>/dev/null
cat C:\Projects\Caps\docs\DRIVE_FOLDERS.md 2>/dev/null
```

## STEP 2 — Check Google Drive for new files

Using the Drive API (if API key available):
```
curl -s "https://www.googleapis.com/drive/v3/files?q=modifiedTime>'2026-03-21T00:00:00'&orderBy=modifiedTime+desc&fields=files(id,name,createdTime,mimeType,parents)&key=$GOOGLE_DRIVE_API_KEY" 2>/dev/null
```

Or check specific CAPS folder:
```
grep -ri "caps.*folder\|CAPS.*DRIVE" C:\Projects\DRIVE_FOLDERS.md C:\Projects\Caps\.env 2>/dev/null
```

List files in all PROJECTS DEBUG subfolders:
```
# Root folder
curl -s "https://www.googleapis.com/drive/v3/files?q='1bwbtdpHbJ1qoJr-y-rrKx-h4iNYFkCHx'+in+parents&fields=files(id,name,mimeType)&key=$GOOGLE_DRIVE_API_KEY" 2>/dev/null
```

For each subfolder found, list its contents too (look for today's files).

## STEP 3 — Check Dashboard

```
curl -s "https://wingman-dashboard-nine.vercel.app" -o /dev/null -w "%{http_code}"
```

Check if dashboard shows CAPS bugs or only Wingman:
```
grep -n "DRIVE_FOLDER_ID\|folder" C:\Projects\wingman\landing\dashboard\index.html | head -10
```

## STEP 4 — Report

```
═══════════════════════════════════════
BUG REPORT PIPELINE CHECK
═══════════════════════════════════════
BugReporter.tsx exists in CAPS: [YES/NO]
Upload destination: [Drive folder / Supabase / other]
Drive folder for CAPS: [folder ID or NOT CONFIGURED]

Files found today (2026-03-21):
  [list files with timestamps]

Dashboard shows CAPS bugs: [YES/NO]
Dashboard URL: [URL]

PIPELINE STATUS: [WORKING / BROKEN / PARTIAL]
WHAT'S MISSING: [list gaps]
═══════════════════════════════════════
```

## DO NOT
- Do NOT change any code
- Do NOT deploy
- ONLY investigate and report

VAMOS CAPS CHECK-BUG-REPORT — END
