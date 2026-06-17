# VAMOS CAPS CAPS-REMOVE-APPLE-AUTH
**Date:** 2026-04-25 IST | **Priority:** CRITICAL — unblocks B461

---

## Remove expo-apple-authentication — Google login only for now

### Verified state (claude.ai checked via github-file):
- `app.json` line 94: registers `expo-apple-authentication` as plugin
- `package.json`: package NOT installed
- `utils/auth.ts` (172 lines): zero references
- `app/_layout.tsx` (538 lines): zero references  
- `app/settings.tsx` (1598 lines): zero references

The plugin is registered but unused. This is what's failing the build. Removing it.

---

## TASK 1 — Remove from app.json

```bash
cd C:/Projects/POKER/Caps

# Find and edit app.json — remove the "expo-apple-authentication" line from plugins array
# Around line 94. The plugins array probably looks like:
#   "plugins": [
#     "expo-router",
#     "expo-apple-authentication",   <-- DELETE THIS LINE
#     "expo-font",
#     ...
#   ]
```

Use this command to verify it was removed:
```bash
grep -n "apple-authentication" app.json
# Should return nothing
```

---

## TASK 2 — Trigger new build

```bash
git add app.json
git commit -m "fix: remove unused expo-apple-authentication plugin (Google login only for now)"
git push origin main
```

---

## TASK 3 — Update build_history

```sql
-- On CAPS DB (gxrpunvhjcrzqnitbqah)
INSERT INTO build_history (build_number, version, platform, status, started_at, fixes)
VALUES (461, '2.7.1', 'ios', 'building', NOW(),
  '["Removed unused expo-apple-authentication plugin from app.json"]'::jsonb);
```

---

## NOTE FOR FUTURE
Apple Sign In is required by Apple ONLY if you ship with another social login (Google) AND target users in regions where it's mandated. We're shipping Google-only first to test the app. Apple Sign In can be added before App Store submission if needed (separate VAMOS, ~30 min work).

---

## AFTER AUDIT
```
expo-apple-authentication removed from app.json:    YES/NO
grep returns no matches:                             YES/NO
Pushed to main:                                      YES/NO
Build B461 triggered:                                YES/NO (gh run list)
Tests passing:                                       [N]/[N]
```

Yes, allow all edits.
VAMOS CAPS CAPS-REMOVE-APPLE-AUTH — END
