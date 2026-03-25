# VAMOS CAPS CRASH-191-ANALYZE
**Date:** 2026-03-23 IST
**Priority:** 🔴 Build 191 crashed AGAIN + UI issues visible on screen

## TWO TASKS:

### Task 1 — Find the crash from recordings
```
cd C:\Projects\Caps
ANON_KEY=$(grep SUPABASE_ANON_KEY .env | cut -d= -f2)

echo "=== ALL bug_reports (last 30) ==="
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/bug_reports?order=created_at.desc&limit=30" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" | python -m json.tool

echo ""
echo "=== CRASH entries ==="
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/bug_reports?description=ilike.*CRASH*&order=created_at.desc&limit=20" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" | python -m json.tool

echo ""
echo "=== CRASH-STEP entries ==="
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/bug_reports?description=ilike.*STEP*&order=created_at.desc&limit=20" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" | python -m json.tool

echo ""
echo "=== Numbered debug entries (H1, H2, etc) ==="
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/bug_reports?description=ilike.*%20H%25&order=created_at.desc&limit=20" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" | python -m json.tool

echo ""
echo "=== Storage: crash screenshots ==="
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/storage/v1/object/list/crash-recordings" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" | python -m json.tool

echo ""
echo "=== ALL entries from today ==="
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/bug_reports?created_at=gte.2026-03-23T00:00:00Z&order=created_at.desc&limit=30" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" | python -m json.tool
```

### Task 2 — Also check: did user send a video?
```
echo "=== Check for WhatsApp videos received ==="
ls -la C:\Users\royea\Downloads\*Video*2026-03-23* 2>/dev/null
ls -la C:\Users\royea\Downloads\*WhatsApp*Video* 2>/dev/null | tail -10
```

If there's a new video — extract frames:
```
# Find latest video:
LATEST_VID=$(ls -t C:\Users\royea\Downloads\*Video*2026-03-23*.mp4 2>/dev/null | head -1)
if [ -n "$LATEST_VID" ]; then
  echo "Analyzing: $LATEST_VID"
  ffmpeg -i "$LATEST_VID" -vf fps=3 "C:\Users\royea\Downloads\crash191_frame_%03d.jpg" -y 2>&1 | tail -3
  
  # Read last 5 frames (right before crash):
  ls -t C:\Users\royea\Downloads\crash191_frame_*.jpg | tail -5
fi
```

Read those frames — look for:
1. **The LAST number in the debug overlay** (what step crashed)
2. **UI issues:** cards too big, buttons cut off, layout problems

### Task 3 — Based on findings, fix BOTH crash + UI

**For the crash:** find the numbered step and fix what's after it.

**For the UI:** Read the user's description:
- Cards too big on boards
- Some buttons not visible
- General layout issues

```bash
# Check responsive system:
grep -n "getCardDimensions\|rv(\|rf(\|DEVICE" components/Board.tsx | head -20
grep -n "getCardDimensions\|rv(\|rf(\|DEVICE" components/Card.tsx | head -20

# Check what device width the user has:
# iPhone 15/16 = 393pt, check if cards overflow
```

Report:
```
CRASH:
  Last step number: [N]
  Crash between: [N] and [N+1]
  Cause: [description]
  Fix: [what changed]

UI ISSUES:
  Cards too big: [where, what size, what should be]
  Buttons hidden: [which buttons, why]
  Fix: [what changed]
```

VAMOS CAPS CRASH-191-ANALYZE — END
