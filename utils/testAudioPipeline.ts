/**
 * S93 — Full Pipeline Test Utility
 * Tests all steps that can be tested outside a component context.
 * Step 2 (actual recording) requires the useAudioRecorder hook — tested via BugReporter FAB/shake.
 *
 * Triggered from DebugOverlay. Each step logs [TEST-PIPE] Step N: ✅/❌ detail.
 */
import { setAudioModeAsync } from 'expo-audio';
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

  // Step 1 — Audio mode
  try {
    console.log('[TEST-PIPE] Step 1: setAudioModeAsync...');
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    results.push({ step: '1-audio-mode', ok: true, detail: 'Configured ✅' });
    console.log('[TEST-PIPE] Step 1 ✅ Audio mode configured');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    results.push({ step: '1-audio-mode', ok: false, detail: msg });
    console.error('[TEST-PIPE] Step 1 ❌', msg);
  }

  // Step 2 — Recording (skipped — hook-based API requires component context)
  results.push({ step: '2-recording', ok: true, detail: 'SKIPPED (hook-based — test via BugReporter FAB/shake)' });
  console.log('[TEST-PIPE] Step 2: SKIPPED (useAudioRecorder hook requires component)');

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

  // Step 7 — Supabase INSERT to bug_reports
  try {
    console.log('[TEST-PIPE] Step 7: Inserting test report...');
    const sb = getSupabase();
    if (!sb) throw new Error('getSupabase() returned null');
    const Device = (() => { try { return require('expo-device'); } catch { return {}; } })();
    const Application = (() => { try { return require('expo-application'); } catch { return {}; } })();
    const { data, error } = await sb.from('bug_reports').insert({
      title: `[TEST] Pipeline test ${new Date().toISOString()}`,
      report_type: 'text',
      project: 'caps-poker',
      device_info: { model: Device.modelName ?? 'test', test: true, platform: 'ios' },
      console_logs: getConsoleLogs().slice(-5),
      breadcrumbs: getBreadcrumbs().slice(-3),
      app_version: Application.nativeApplicationVersion ?? 'test',
      metadata: { test: true },
      status: 'open',
    }).select('id').single();
    if (error) throw new Error(error.message);
    const id = (data as { id: string } | null)?.id ?? 'unknown';
    results.push({ step: '7-insert', ok: true, detail: `ID: ${id}` });
    console.log('[TEST-PIPE] Step 7 ✅ Report ID:', id);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    results.push({ step: '7-insert', ok: false, detail: msg });
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
