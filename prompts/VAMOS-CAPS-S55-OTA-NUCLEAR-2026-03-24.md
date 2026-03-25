# VAMOS CAPS CAPS-S55-OTA-NUCLEAR
**Date:** 2026-03-24 IST
**Priority:** CRITICAL — Device stuck on old OTA despite multiple deploys

---

## BEFORE AUDIT

```bash
cd C:\Projects\Caps
git log --oneline -5
eas build:list --platform ios --limit 1 --json 2>/dev/null | python -m json.tool | grep -E "buildNumber|channel|runtimeVersion|id"
eas update:list --branch production --limit 5
cat app.json | python -m json.tool | grep -A 10 '"updates"'
```

---

## TASK A — FULL OTA DIAGNOSIS

### A1. Check EVERY possible mismatch:
```bash
# What runtimeVersion does the binary (build 230) have?
eas build:list --platform ios --limit 1 --json 2>/dev/null | python -m json.tool | grep runtimeVersion

# What runtimeVersion does the latest OTA have?
eas update:list --branch production --limit 1 --json 2>/dev/null | python -m json.tool | grep runtimeVersion

# What channel does build 230 use?
eas build:list --platform ios --limit 1 --json 2>/dev/null | python -m json.tool | grep channel

# What branch is OTA on?
eas update:list --branch production --limit 3 --json 2>/dev/null | python -m json.tool | grep -E "branch|channel|runtimeVersion|id|message"
```

### A2. Check expo-updates config in the ACTUAL BUILT BINARY:
```bash
# Check what channel the app.json says right now:
cat app.json | python -m json.tool | grep -E "channel|runtimeVersion|requestHeaders"

# Check eas.json production profile:
cat eas.json | python -m json.tool
```

### A3. Check if OTA is actually being checked at launch:
```bash
# Find the OTA check code in _layout.tsx:
grep -n "Updates\|checkForUpdate\|fetchUpdate\|reloadAsync" app/_layout.tsx | head -20
```

---

## TASK B — NUCLEAR FIX OPTIONS (try all, in order)

### B1. Re-deploy OTA to EVERY possible branch/channel:
```bash
# Deploy to all branches that might match:
eas update --branch production --message "nuclear: S49-S54 all fixes"
eas update --branch main --message "nuclear: S49-S54 all fixes" 2>/dev/null || echo "no main branch"
eas update --branch preview --message "nuclear: S49-S54 all fixes" 2>/dev/null || echo "no preview branch"
eas update --branch default --message "nuclear: S49-S54 all fixes" 2>/dev/null || echo "no default branch"
```

### B2. Force immediate OTA check AND reload in _layout.tsx:

Replace the existing OTA check with this nuclear version:
```typescript
import * as Updates from 'expo-updates';

// In root layout, FIRST useEffect:
useEffect(() => {
  if (__DEV__) return;
  
  const forceUpdate = async () => {
    try {
      console.log('[OTA] Checking for update...');
      console.log('[OTA] Current update ID:', Updates.updateId);
      console.log('[OTA] Channel:', Updates.channel);
      console.log('[OTA] Runtime version:', Updates.runtimeVersion);
      
      const update = await Updates.checkForUpdateAsync();
      console.log('[OTA] Update available:', update.isAvailable);
      
      if (update.isAvailable) {
        console.log('[OTA] Fetching update...');
        await Updates.fetchUpdateAsync();
        console.log('[OTA] Reloading...');
        await Updates.reloadAsync();
      }
    } catch (e) {
      console.log('[OTA] Error:', e);
    }
  };
  
  // Check immediately on mount:
  forceUpdate();
  
  // Also check every 30 seconds while app is open:
  const interval = setInterval(forceUpdate, 30000);
  return () => clearInterval(interval);
}, []);
```

### B3. Add OTA debug info to Settings screen:
In `app/settings.tsx`, expand the OTA display to show ALL relevant info:
```typescript
import * as Updates from 'expo-updates';

// Add this section in Settings:
<View>
  <Text>OTA ID: {Updates.updateId?.slice(0,8) ?? 'none'}</Text>
  <Text>Channel: {Updates.channel ?? 'unknown'}</Text>
  <Text>Runtime: {Updates.runtimeVersion ?? 'unknown'}</Text>
  <Text>Created: {Updates.createdAt?.toISOString().slice(0,10) ?? 'unknown'}</Text>
  <Text>Is embedded: {Updates.isEmbeddedLaunch ? 'YES' : 'NO'}</Text>
</View>
```

### B4. If runtimeVersion mismatch found — fix app.json:
If binary runtimeVersion ≠ OTA runtimeVersion, update app.json:
```json
"runtimeVersion": {
  "policy": "appVersion"
}
```
Then redeploy OTA.

---

## TASK C — SIMULATION: 3 OTA EXPERTS DIAGNOSE

Simulate these experts reading the full diagnosis output and giving their verdict:

**Expert 1 — Expo SDK engineer:**
- What is the most likely root cause given the symptoms?
- What would they check first that we haven't checked?

**Expert 2 — React Native CI/CD specialist:**
- Is the channel/branch mapping correct?
- What's the exact EAS update delivery flow and where could it break?

**Expert 3 — iOS deployment engineer:**
- Could iOS itself be caching the old OTA?
- Are there any iOS-level fixes (clear cache, reinstall from TestFlight)?

Each expert gives ONE definitive fix recommendation.

---

## TASK D — VERIFY DELIVERY

After deploying:
```bash
# Get the new OTA hash:
eas update:list --branch production --limit 1

# Confirm runtimeVersion matches binary:
echo "Binary runtimeVersion:"
eas build:list --platform ios --limit 1 --json 2>/dev/null | python -m json.tool | grep runtimeVersion
echo "OTA runtimeVersion:"  
eas update:list --branch production --limit 1 --json 2>/dev/null | python -m json.tool | grep runtimeVersion
```

---

## TASK E — Git

```bash
git add -A && git commit -m "fix(S55): nuclear OTA fix — force check every 30s + full OTA debug in Settings"
git push origin main
git log --oneline -3
```

---

## AFTER AUDIT

```
═══════════════════════════════════════
CAPS-S55 — OTA NUCLEAR AUDIT
═══════════════════════════════════════
Binary (build 230):
  - runtimeVersion: [value]
  - channel: [value]

Latest OTA (production branch):
  - runtimeVersion: [value]  
  - branch: [value]
  - id: [hash]

runtimeVersion MATCH: [YES/NO]
channel/branch MATCH: [YES/NO]

Branches deployed to: [production / main / preview / default]
New OTA hash: [hash]

Force check (every 30s): [YES/NO — in _layout.tsx]
OTA debug in Settings: [YES/NO — shows channel + runtimeVersion + isEmbeddedLaunch]

Expert 1 verdict: [root cause + fix]
Expert 2 verdict: [channel mapping + fix]
Expert 3 verdict: [iOS cache + fix]

TS errors: 0
Tests: 2234/2234
Git: [commit]
Build: [from eas build:list]
═══════════════════════════════════════
```

---

## DO NOT
- Do NOT skip the runtimeVersion comparison — this is the #1 suspect
- Do NOT deploy OTA without confirming the channel matches the binary
- Do NOT skip the expert simulation
- Do NOT give up after one approach — try ALL branches

Yes, allow all edits in components/ during this session.

VAMOS CAPS CAPS-S55-OTA-NUCLEAR — END
