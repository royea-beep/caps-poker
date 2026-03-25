# VAMOS CAPS WHATSAPP-CRASH-CONTROL
**Date:** 2026-03-23 08:37 IST
**Priority:** 🟡 Build WhatsApp crash control panel — receive videos + approve fixes

## CONCEPT

Roye's second phone = dedicated crash monitoring station.
Every crash → WhatsApp message with video + debug info + action buttons.

```
📱 WhatsApp receives:
╔══════════════════════════════════════╗
║ 🔴 CAPS CRASH — Build 191           ║
║                                      ║
║ Last step: C5 (dismiss timer 2s)     ║
║ Cause: ConfettiCannon 180 views      ║
║        unmount mid-animation         ║
║                                      ║
║ 🎥 Video: [link]                     ║
║ 📸 Screenshot: [link]                ║
║ 📝 Debug logs: 30 entries            ║
║                                      ║
║ Reply:                               ║
║  1 = 🔧 Auto-fix (Claude analyzes   ║
║      + generates fix + deploys)      ║
║  2 = 👀 Show me the analysis first   ║
║  3 = ⏭️ Skip (not important)         ║
║  4 = 🔄 Re-run marathon (test again) ║
║  5 = 🟢 Enable AUTO-FIX mode        ║
║      (all future crashes fixed       ║
║       without asking — testing mode) ║
║  6 = 🔴 Disable AUTO-FIX mode       ║
║  7 = 📊 Show crash dashboard         ║
╚══════════════════════════════════════╝
```

## FIRST ACTIONS
```
cd C:\Projects\Caps
Read MEMORY.md
cat supabase/functions/whatsapp-bot-handler/index.ts
```

═══════════════════════════════════════════════════════════
AGENT 1 — CRASH NOTIFICATION FORMAT
═══════════════════════════════════════════════════════════

Update the crash notification to include rich menu options:

```typescript
// In utils/crashAlert.ts — update sendCrashAlert:

export async function sendCrashAlert(
  videoUrl: string | null,
  screenshotUrl: string | null,
  lastStep: string,
  debugLogs: string[],
  metadata: Record<string, string>
): Promise<void> {
  const message = [
    '🔴 *CAPS CRASH*',
    `Build: ${metadata.build}`,
    `Step: ${lastStep}`,
    `Time: ${new Date().toLocaleTimeString('he-IL')}`,
    '',
    videoUrl ? `🎥 Video: ${videoUrl}` : '',
    screenshotUrl ? `📸 Screenshot: ${screenshotUrl}` : '',
    `📝 Logs: ${debugLogs.length} entries`,
    '',
    '*Reply:*',
    '1 = 🔧 Auto-fix now',
    '2 = 👀 Show analysis',
    '3 = ⏭️ Skip',
    '4 = 🔄 Run marathon again',
    '5 = 🟢 AUTO-FIX ON (all crashes)',
    '6 = 🔴 AUTO-FIX OFF',
    '7 = 📊 Crash dashboard',
  ].filter(Boolean).join('\n');
  
  await fetch(
    `${SUPABASE_URL}/functions/v1/whatsapp-bot-handler`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        crash_notification: true,
        message,
        videoUrl,
        screenshotUrl,
        debugLogs: debugLogs.slice(-20),
        metadata,
      }),
    }
  );
}
```

═══════════════════════════════════════════════════════════
AGENT 2 — WHATSAPP BOT: Handle all reply options
═══════════════════════════════════════════════════════════

Update the WhatsApp bot handler to process numbered replies:

```typescript
// In supabase/functions/whatsapp-bot-handler/index.ts:

// Add to the message handler:
const AUTO_FIX_KEY = 'caps_auto_fix_mode';

async function handleCrashReply(messageText: string, supabase: any) {
  const trimmed = messageText.trim();
  
  // ═══ Option 1: Auto-fix ═══
  if (trimmed === '1' || trimmed.toLowerCase() === 'fix' || trimmed === 'תקן') {
    // Get latest crash analysis:
    const { data: latest } = await supabase
      .from('bug_reports')
      .select('*')
      .eq('severity', 'CRITICAL')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (!latest) {
      return 'No crash report found. Send a video or wait for next crash.';
    }
    
    // Trigger crash-analyzer → then auto-apply:
    await fetch(`${SUPABASE_URL}/functions/v1/crash-analyzer`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        crashReport: {
          type: 'manual-fix-request',
          ...JSON.parse(latest.metadata || '{}'),
          autoApply: true,  // ← tells analyzer to also trigger GitHub Actions
        }
      }),
    });
    
    return '🔧 Fix triggered! Claude is analyzing + applying fix. OTA in ~2 minutes.';
  }
  
  // ═══ Option 2: Show analysis ═══
  if (trimmed === '2') {
    const { data: latest } = await supabase
      .from('bug_reports')
      .select('*')
      .ilike('description', '%AUTO-ANALYSIS%')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (!latest?.metadata) {
      // No analysis yet — trigger one:
      await fetch(`${SUPABASE_URL}/functions/v1/crash-analyzer`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({
          crashReport: {
            type: 'analysis-only',
            autoApply: false,
          }
        }),
      });
      return '🔍 Analyzing... will send results in ~30 seconds.';
    }
    
    const analysis = JSON.parse(latest.metadata);
    const a = analysis.analysis || {};
    return [
      '🔍 *CRASH ANALYSIS:*',
      `Step: ${a.crash_step || 'unknown'}`,
      `Cause: ${a.crash_cause || 'unknown'}`,
      `Fix: ${a.fix_description || 'unknown'}`,
      `File: ${a.fix_file || 'unknown'}`,
      '',
      a.ui_issues?.length ? `UI Issues: ${a.ui_issues.join(', ')}` : '',
      '',
      'Reply *1* to apply this fix.',
    ].filter(Boolean).join('\n');
  }
  
  // ═══ Option 3: Skip ═══
  if (trimmed === '3' || trimmed.toLowerCase() === 'skip' || trimmed === 'דלג') {
    // Mark latest crash as skipped:
    const { data: latest } = await supabase
      .from('bug_reports')
      .select('id')
      .eq('severity', 'CRITICAL')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (latest) {
      await supabase.from('bug_reports').update({ status: 'skipped' }).eq('id', latest.id);
    }
    return '⏭️ Skipped. Will alert on next crash.';
  }
  
  // ═══ Option 4: Re-run marathon ═══
  if (trimmed === '4' || trimmed.toLowerCase() === 'marathon') {
    // This needs to send a push notification to the app to start marathon
    // OR: use app_config table to set a flag:
    await supabase.from('app_config').upsert({
      key: 'run_marathon',
      value: JSON.stringify({ requested: true, timestamp: new Date().toISOString() }),
    });
    return '🔄 Marathon requested! Open the app — it will auto-start 10 hands.';
  }
  
  // ═══ Option 5: Enable AUTO-FIX ═══
  if (trimmed === '5' || trimmed.toLowerCase() === 'auto' || trimmed === 'אוטו') {
    await supabase.from('app_config').upsert({
      key: AUTO_FIX_KEY,
      value: JSON.stringify({ enabled: true, since: new Date().toISOString() }),
    });
    return '🟢 *AUTO-FIX MODE ON*\n\nAll future crashes will be automatically:\n1. Analyzed by Claude\n2. Fix generated\n3. OTA deployed\n\nNo approval needed. Reply *6* to disable.';
  }
  
  // ═══ Option 6: Disable AUTO-FIX ═══
  if (trimmed === '6') {
    await supabase.from('app_config').upsert({
      key: AUTO_FIX_KEY,
      value: JSON.stringify({ enabled: false, since: new Date().toISOString() }),
    });
    return '🔴 *AUTO-FIX MODE OFF*\n\nYou will be asked to approve each fix.';
  }
  
  // ═══ Option 7: Dashboard ═══
  if (trimmed === '7' || trimmed.toLowerCase() === 'dashboard' || trimmed === 'דשבורד') {
    const { count: totalCrashes } = await supabase
      .from('bug_reports')
      .select('*', { count: 'exact', head: true })
      .eq('severity', 'CRITICAL');
    
    const { count: fixedCrashes } = await supabase
      .from('bug_reports')
      .select('*', { count: 'exact', head: true })
      .eq('severity', 'CRITICAL')
      .eq('status', 'fixed');
    
    const { data: autoFixConfig } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', AUTO_FIX_KEY)
      .single();
    
    const autoFixEnabled = autoFixConfig?.value ? JSON.parse(autoFixConfig.value).enabled : false;
    
    return [
      '📊 *CRASH DASHBOARD:*',
      `Total crashes: ${totalCrashes || 0}`,
      `Fixed: ${fixedCrashes || 0}`,
      `Open: ${(totalCrashes || 0) - (fixedCrashes || 0)}`,
      `Auto-fix: ${autoFixEnabled ? '🟢 ON' : '🔴 OFF'}`,
      '',
      `Web: https://caps.ftable.co.il/bugs/`,
    ].join('\n');
  }
  
  return null; // Not a crash reply — let normal handler process
}
```

═══════════════════════════════════════════════════════════
AGENT 3 — AUTO-FIX MODE: Check before asking
═══════════════════════════════════════════════════════════

When a crash happens and AUTO-FIX is ON → skip the WhatsApp menu, go straight to fix:

```typescript
// In crash-analyzer Edge Function OR in crashDetector.ts:

async function onCrashDetected(crashData) {
  // Check if auto-fix is enabled:
  const { data: config } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'caps_auto_fix_mode')
    .single();
  
  const autoFixEnabled = config?.value ? JSON.parse(config.value).enabled : false;
  
  if (autoFixEnabled) {
    // Skip WhatsApp menu — go straight to analyze + fix:
    debugLog('🤖 AUTO-FIX MODE — analyzing + fixing automatically');
    
    await sendWhatsApp(ROYE_PHONE, 
      `🤖 AUTO-FIX: Crash detected at step ${crashData.lastStep}. Analyzing + fixing...`
    );
    
    // Trigger analyzer with autoApply=true:
    await triggerAnalyzer(crashData, { autoApply: true });
    
  } else {
    // Show menu:
    await sendCrashAlert(crashData);
  }
}
```

═══════════════════════════════════════════════════════════
AGENT 4 — MARATHON AUTO-START from WhatsApp
═══════════════════════════════════════════════════════════

When user replies "4" → set flag in app_config → app checks on open:

```typescript
// In app/_layout.tsx — check for marathon request on app open:

useEffect(() => {
  (async () => {
    try {
      const supabase = getSupabase();
      if (!supabase) return;
      
      const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'run_marathon')
        .single();
      
      if (data?.value) {
        const config = JSON.parse(data.value);
        if (config.requested) {
          // Clear the flag:
          await supabase.from('app_config').upsert({
            key: 'run_marathon',
            value: JSON.stringify({ requested: false }),
          });
          
          // Navigate to marathon:
          debugLog('🤖 Marathon requested via WhatsApp — starting');
          setTimeout(() => {
            router.push('/game?autoSim=true&autoSimCount=10');
          }, 2000);
        }
      }
    } catch {}
  })();
}, []);
```

═══════════════════════════════════════════════════════════
AGENT 5 — Video handling in WhatsApp
═══════════════════════════════════════════════════════════

When Roye sends a crash video to WhatsApp → bot processes it:

```typescript
// In whatsapp-bot-handler — handle media messages:

if (numMedia > 0 && mediaContentType?.includes('video')) {
  // Download from Twilio:
  const mediaUrl = body.MediaUrl0;
  const authHeader = `Basic ${btoa(`${TWILIO_SID}:${TWILIO_AUTH}`)}`;
  const videoResponse = await fetch(mediaUrl, { headers: { Authorization: authHeader } });
  const videoBuffer = await videoResponse.arrayBuffer();
  
  // Upload to Supabase Storage:
  const fileName = `crash-video-${Date.now()}.mp4`;
  await supabase.storage.from('crash-recordings').upload(
    fileName, 
    new Uint8Array(videoBuffer),
    { contentType: 'video/mp4' }
  );
  
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/crash-recordings/${fileName}`;
  
  // Save to bug_reports:
  await supabase.from('bug_reports').insert({
    description: '[CRASH-VIDEO] Received via WhatsApp',
    severity: 'CRITICAL',
    screenshot_url: publicUrl,
    status: 'open',
  });
  
  // Reply with options:
  const reply = [
    '🎥 Video received and saved!',
    `Link: ${publicUrl}`,
    '',
    '*Reply:*',
    '1 = 🔧 Auto-fix based on this video',
    '2 = 👀 Analyze video first',
    '3 = ⏭️ Skip',
  ].join('\n');
  
  return reply;
}
```

═══════════════════════════════════════════════════════════
DEPLOY
═══════════════════════════════════════════════════════════

```bash
# Edge Function:
supabase functions deploy whatsapp-bot-handler --no-verify-jwt
supabase functions deploy crash-analyzer --no-verify-jwt

# App code:
npx tsc --noEmit
npx jest --forceExit 2>&1 | tail -5

eas update --branch production --message "feat: WhatsApp crash control panel — 7 reply options + auto-fix mode"
git add -A && git commit -m "feat: WhatsApp crash control panel + auto-fix mode + marathon trigger + video upload"
git push origin main
```

## REPORT
```
═══════════════════════════════════════
WHATSAPP CRASH CONTROL — REPORT
═══════════════════════════════════════
Crash notification format: [updated with 7 options / NO]
Reply handler:
  1 (auto-fix): [YES/NO]
  2 (show analysis): [YES/NO]
  3 (skip): [YES/NO]
  4 (marathon): [YES/NO]
  5 (auto-fix ON): [YES/NO]
  6 (auto-fix OFF): [YES/NO]
  7 (dashboard): [YES/NO]
Auto-fix mode: [YES — stored in app_config]
Marathon from WhatsApp: [YES — flag in app_config]
Video upload from WhatsApp: [YES/NO]
Dirty shutdown detector: [YES/NO]
Log persistence: [YES/NO]
Edge Function deployed: [crash-analyzer / whatsapp-bot-handler]
OTA: [ID]
Build: [triggered]
═══════════════════════════════════════
```

## DO NOT
- Do NOT send crash notifications to random numbers — only Roye's phone
- Do NOT auto-fix without checking auto-fix mode flag
- Do NOT block the WhatsApp handler — respond fast, process async
- Do NOT lose video data — always upload to Supabase Storage first

VAMOS CAPS WHATSAPP-CRASH-CONTROL — END
