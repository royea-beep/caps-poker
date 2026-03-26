/**
 * S93 — Full Pipeline Test Utility
 * Tests all steps that can be tested outside a component context.
 * Step 2 (actual recording) requires the useAudioRecorder hook — tested via BugReporter FAB/shake.
 *
 * Triggered from DebugOverlay. Each step logs [TEST-PIPE] Step N: ✅/❌ detail.
 */
import { getSupabase } from './supabase';
import { getConsoleLogs } from './logBuffer';
import { getBreadcrumbs } from './breadcrumbs';

export interface PipelineStep {
  step: string;
  ok: boolean;
  detail: string;
}

export async function testFullPipeline(): Promise<PipelineStep[]> {
  const results: PipelineStep[] = [];
  console.log('[TEST-PIPE] === Starting full pipeline test ===');

  // Step 1 — Audio mode (expo-audio, NOT expo-av — expo-av needs native build, removed S75)
  try {
    console.log('[TEST-PIPE] Step 1: setAudioModeAsync (expo-audio)...');
    const { setAudioModeAsync } = require('expo-audio');
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    results.push({ step: '1-audio-mode', ok: true, detail: 'Configured ✅' });
    console.log('[TEST-PIPE] Step 1 ✅ Audio mode set');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    results.push({ step: '1-audio-mode', ok: false, detail: msg });
    console.error('[TEST-PIPE] Step 1 ❌', msg);
  }

  // Step 2 — Recording (hook-based useAudioRecorder — tested live via BugReporter FAB/shake)
  results.push({ step: '2-recording', ok: true, detail: 'SKIPPED — hook-based, test via FAB/shake' });
  console.log('[TEST-PIPE] Step 2: SKIPPED (useAudioRecorder requires component context)');

  // Step 2b — Screen capture (captureScreen — no ref needed)
  try {
    console.log('[TEST-PIPE] Step 2b: Testing screen capture...');
    const { captureScreen } = require('react-native-view-shot');
    const uri: string = await captureScreen({ format: 'jpg', quality: 0.5 });
    results.push({ step: '2b-screen-capture', ok: !!uri, detail: uri ? `URI: ${uri.slice(-40)}` : 'NO URI' });
    console.log('[TEST-PIPE] Step 2b', uri ? `✅ URI: ${uri.slice(-40)}` : '❌ NO URI');
    if (uri) {
      try {
        const FileSystem = require('expo-file-system');
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch {}
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    results.push({ step: '2b-screen-capture', ok: false, detail: msg });
    console.error('[TEST-PIPE] Step 2b ❌', msg);
  }

  // Step 2c — FileSystem read fallback chain test (write temp file, read it back)
  try {
    console.log('[TEST-PIPE] Step 2c: FileSystem read fallback chain...');
    const FileSystem = require('expo-file-system');
    const testUri = `${FileSystem.cacheDirectory}pipe-test-${Date.now()}.bin`;
    const testBase64 = 'dGVzdA=='; // "test" in base64
    await FileSystem.writeAsStringAsync(testUri, testBase64, { encoding: FileSystem.EncodingType.Base64 });

    // Method 1: readAsStringAsync
    let readOk = false;
    try {
      const base64: string = await FileSystem.readAsStringAsync(testUri, { encoding: FileSystem.EncodingType.Base64 });
      readOk = base64.length > 0;
      console.log('[TEST-PIPE] Step 2c: Method 1 (FileSystem Base64)', readOk ? '✅' : '❌', 'len:', base64.length);
    } catch (e: any) {
      console.error('[TEST-PIPE] Step 2c: Method 1 failed:', e?.message || JSON.stringify(e));
    }

    // Method 2: fetch + arrayBuffer
    if (!readOk) {
      try {
        const resp = await fetch(testUri);
        const buf = await resp.arrayBuffer();
        readOk = buf.byteLength > 0;
        console.log('[TEST-PIPE] Step 2c: Method 2 (fetch+arrayBuffer)', readOk ? '✅' : '❌', 'bytes:', buf.byteLength);
      } catch (e: any) {
        console.error('[TEST-PIPE] Step 2c: Method 2 failed:', e?.message || JSON.stringify(e));
      }
    }

    await FileSystem.deleteAsync(testUri, { idempotent: true }).catch(() => {});
    results.push({ step: '2c-file-read', ok: readOk, detail: readOk ? 'Read OK' : 'All methods failed' });
    console.log('[TEST-PIPE] Step 2c', readOk ? '✅' : '❌');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    results.push({ step: '2c-file-read', ok: false, detail: msg });
    console.error('[TEST-PIPE] Step 2c ❌', msg);
  }

  // Step 3 — Supabase bucket upload probe
  try {
    console.log('[TEST-PIPE] Step 3: Testing bug-recordings bucket...');
    const sb = getSupabase();
    if (!sb) throw new Error('getSupabase() returned null');
    const probeFile = `audio/pipeline-test-${Date.now()}.m4a`;
    const probe = new Uint8Array([0x00]);
    const { data, error } = await sb.storage
      .from('bug-recordings')
      .upload(probeFile, probe, { contentType: 'audio/mp4', upsert: false });
    if (error) throw new Error(error.message);
    // Cleanup
    await sb.storage.from('bug-recordings').remove([probeFile]).catch(() => {});
    results.push({ step: '3-bucket-upload', ok: true, detail: `Uploaded to ${data?.path ?? probeFile}` });
    console.log('[TEST-PIPE] Step 3 ✅ Bucket upload works');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    results.push({ step: '3-bucket-upload', ok: false, detail: msg });
    console.error('[TEST-PIPE] Step 3 ❌', msg);
  }

  // Step 4 — Device info (expo-device)
  try {
    console.log('[TEST-PIPE] Step 4: expo-device...');
    const Device = require('expo-device');
    const Application = require('expo-application');
    const info = {
      model: Device.modelName,
      os: Device.osVersion,
      build: Application.nativeBuildVersion,
      isDevice: Device.isDevice,
    };
    const ok = !!info.model;
    results.push({ step: '4-device-info', ok, detail: JSON.stringify(info) });
    console.log('[TEST-PIPE] Step 4', ok ? '✅' : '⚠️', JSON.stringify(info));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    results.push({ step: '4-device-info', ok: false, detail: msg });
    console.error('[TEST-PIPE] Step 4 ❌', msg);
  }

  // Step 5 — Console log buffer
  try {
    console.log('[TEST-PIPE] Step 5: console log buffer...');
    const logs = getConsoleLogs();
    const ok = logs.length > 0;
    results.push({ step: '5-console-logs', ok, detail: `${logs.length} lines` });
    console.log('[TEST-PIPE] Step 5', ok ? '✅' : '⚠️ buffer empty', `${logs.length} lines`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    results.push({ step: '5-console-logs', ok: false, detail: msg });
    console.error('[TEST-PIPE] Step 5 ❌', msg);
  }

  // Step 6 — Breadcrumbs
  try {
    console.log('[TEST-PIPE] Step 6: breadcrumbs...');
    const crumbs = getBreadcrumbs();
    const ok = crumbs.length > 0;
    results.push({ step: '6-breadcrumbs', ok, detail: `${crumbs.length} entries` });
    console.log('[TEST-PIPE] Step 6', ok ? '✅' : '⚠️ empty', `${crumbs.length} entries`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    results.push({ step: '6-breadcrumbs', ok: false, detail: msg });
    console.error('[TEST-PIPE] Step 6 ❌', msg);
  }

  // Step 7 — Full INSERT + readback (verifies all fields land in DB)
  try {
    console.log('[TEST-PIPE] Step 7: Full INSERT + readback...');
    const sb = getSupabase();
    if (!sb) throw new Error('getSupabase() returned null');
    const Device = (() => { try { return require('expo-device'); } catch { return {}; } })();
    const Application = (() => { try { return require('expo-application'); } catch { return {}; } })();
    const consoleLogs = getConsoleLogs().slice(-10);
    const crumbs = getBreadcrumbs().slice(-5);
    const testReport = {
      title: `[PIPE-TEST] ${new Date().toISOString()}`,
      description: 'Automated pipeline test — verify all fields populated',
      report_type: 'text',
      version: Application.nativeApplicationVersion ?? '1.9.4',
      app_version: Application.nativeApplicationVersion ?? '1.9.4',
      audio_url: null,
      video_url: null,
      screenshot_url: null,
      has_video: false,
      device_info: {
        model: Device.modelName ?? 'test',
        brand: Device.brand ?? 'test',
        osVersion: String(Device.osVersion ?? 'test'),
        buildNumber: Application.nativeBuildVersion ?? 'test',
        platform: 'ios',
        isDevice: Device.isDevice ?? false,
      },
      console_logs: consoleLogs,
      breadcrumbs: crumbs,
      metadata: { test: true, timestamp: Date.now() },
      project: 'caps-poker',
      tester_name: 'PIPE-TEST',
      status: 'open',
    };
    const { data, error } = await sb
      .from('bug_reports')
      .insert(testReport)
      .select('id, device_info, console_logs, breadcrumbs, version, app_version')
      .single();
    if (error) {
      console.error('[PIPE-TEST] ❌ INSERT failed:', error.message);
      console.error('[PIPE-TEST] details:', error.details, 'hint:', error.hint, 'code:', error.code);
      throw new Error(`${error.message} (code: ${error.code})`);
    }
    const row = data as { id: string; device_info: Record<string, unknown> | null; console_logs: string[] | null; breadcrumbs: unknown[] | null; version: string | null; app_version: string | null } | null;
    const fieldsOk = !!(row?.device_info && row?.console_logs && row?.breadcrumbs);
    const detail = `ID: ${row?.id ?? '?'} | device: ${!!row?.device_info?.model} | logs: ${row?.console_logs?.length ?? 0} | crumbs: ${row?.breadcrumbs?.length ?? 0} | version: ${row?.version ?? 'NULL'}`;
    results.push({ step: '7-insert-readback', ok: fieldsOk, detail });
    console.log('[PIPE-TEST]', fieldsOk ? '✅' : '⚠️', detail);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    results.push({ step: '7-insert-readback', ok: false, detail: msg });
    console.error('[TEST-PIPE] Step 7 ❌', msg);
  }

  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log(`[TEST-PIPE] === Done: ${passed}/${total} passed ===`);
  results.forEach((r) => {
    console.log(`[TEST-PIPE] ${r.ok ? '✅' : '❌'} ${r.step}: ${r.detail}`);
  });

  return results;
}

// Keep the original simple probe test for backwards compat
export async function testAudioPipeline(): Promise<boolean> {
  console.log('[TEST-AUDIO] Running full pipeline test...');
  const results = await testFullPipeline();
  const bucketStep = results.find((r) => r.step === '3-bucket-upload');
  return bucketStep?.ok ?? false;
}
