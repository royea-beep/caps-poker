# VAMOS CAPS CHECK-RECORDINGS
## DO NOT change code. ONLY check what was captured.

```
cd C:\Projects\Caps
ANON_KEY=$(grep SUPABASE_ANON_KEY .env | cut -d= -f2)

echo "=== CRASH SCREENSHOTS IN STORAGE ==="
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/storage/v1/object/list/crash-recordings" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" | python -m json.tool

echo ""
echo "=== CRASH REPORTS (last 20) ==="
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/bug_reports?order=created_at.desc&limit=20" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" | python -m json.tool

echo ""
echo "=== CRASH-VIDEO entries ==="
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/bug_reports?description=ilike.*CRASH-VIDEO*&order=created_at.desc&limit=5" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" | python -m json.tool

echo ""
echo "=== CRASH-STEP entries ==="
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/bug_reports?description=ilike.*CRASH-STEP*&order=created_at.desc&limit=10" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" | python -m json.tool
```

For any screenshots found in storage, provide public URLs:
```
https://gxrpunvhjcrzqnitbqah.supabase.co/storage/v1/object/public/crash-recordings/FILENAME
```

VAMOS CAPS CHECK-RECORDINGS — END
