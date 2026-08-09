/**
 * BugReporter for CAPS Poker — S93 Full Pipeline Rebuild
 *
 * Flow: FAB/shake → start recordings → floating pill (game stays playable)
 *       Tap pill → minimal bottom sheet → Send / Discard
 *       Send → upload audio + frame → collect device/logs/breadcrumbs → INSERT → AI triage
 *
 * ZERO Reanimated — RN Animated for dot pulse only (iron rule).
 *
 * S93 changes:
 *  - All 6 pipeline steps with [BUG-PIPE] console.log at each sub-step
 *  - device_info, console_logs, breadcrumbs in every INSERT
 *  - AI triage runs AFTER insert (with full report data)
 *  - Temp file cleanup after send
 *  - Uses Supabase JS client for INSERT (not raw fetch)
 */
declare global { var __bugReporterScreenshot: string | undefined; }

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Modal, Platform, Keyboard, Animated, Image, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { getGlobalLogs, debugLog } from './DebugOverlay';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { startRecording, stopRecording, getLastCrashScreenshots } from '../utils/screenRecorder';
import { getSupabase } from '../utils/supabase';
import { getConsoleLogs, getGameLogs } from '../utils/logBuffer';
import { getBreadcrumbs, addBreadcrumb } from '../utils/breadcrumbs';
import { track } from '../utils/analytics';
import { readFileAsBytes } from '../utils/fileReader';
import { playHaptic } from '../utils/haptics';
import { withTimeout } from '../utils/withTimeout';
import { sendBugReportToWhatsApp, buildBugFixPrompt } from '../utils/bugWhatsApp';

let Haptics: typeof import('expo-haptics') | null = null;
if (Platform.OS !== 'web') { try { Haptics = require('expo-haptics'); } catch {} }

const PROJECT = 'caps-poker';
const VERSION = Constants.expoConfig?.version ?? '1.9.4';
const MAX_AUTO_STOP_S = 60;
type Phase = 'idle' | 'recording' | 'review';

// ─── Device Info ─────────────────────────────────────────────────────────────

interface DeviceInfo {
  model: string;
  brand: string;
  osName: string;
  osVersion: string;
  buildNumber: string;
  appVersion: string;
  platform: string;
  isDevice: boolean;
}

function collectDeviceInfo(): DeviceInfo {
  try {
    const Device = require('expo-device');
    const Application = require('expo-application');
    return {
      model: Device.modelName ?? 'Unknown',
      brand: Device.brand ?? 'Unknown',
      osName: Device.osName ?? Platform.OS,
      osVersion: String(Device.osVersion ?? Platform.Version ?? 'Unknown'),
      buildNumber: Application.nativeBuildVersion ?? 'Unknown',
      appVersion: Application.nativeApplicationVersion ?? VERSION,
      platform: Platform.OS,
      isDevice: Device.isDevice ?? false,
    };
  } catch {
    return {
      model: 'Unknown',
      brand: 'Unknown',
      osName: Platform.OS,
      osVersion: String(Platform.Version ?? 'Unknown'),
      buildNumber: 'Unknown',
      appVersion: VERSION,
      platform: Platform.OS,
      isDevice: false,
    };
  }
}

// ─── Shake Detection ─────────────────────────────────────────────────────────

function useShakeDetection(onShake: () => void, enabled: boolean) {
  const lastShake = useRef(0);
  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    let sub: { remove: () => void } | null = null;
    (async () => {
      try {
        const Accelerometer = (await import('expo-sensors')).Accelerometer;
        Accelerometer.setUpdateInterval(100);
        let lastX = 0, lastY = 0, lastZ = 0;
        sub = Accelerometer.addListener(({ x, y, z }) => {
          const delta = Math.abs(x - lastX) + Math.abs(y - lastY) + Math.abs(z - lastZ);
          lastX = x; lastY = y; lastZ = z;
          if (delta > 3.5) {
            const now = Date.now();
            if (now - lastShake.current > 2000) { lastShake.current = now; onShake(); }
          }
        });
      } catch {}
    })();
    return () => { sub?.remove(); };
  }, [enabled, onShake]);
}

// ─── File Upload Utilities ────────────────────────────────────────────────────
// File reading delegated to utils/fileReader.ts (3-method fallback chain)

async function uploadAudio(uri: string): Promise<string | null> {
  try {
    console.log('[BUG-PIPE] Step 4a: Reading audio file from URI:', uri);
    const bytes = await readFileAsBytes(uri);
    if (!bytes) { console.error('[BUG-PIPE] Step 4a: ❌ Could not read audio file'); return null; }

    const sb = getSupabase();
    if (!sb) { console.error('[BUG-PIPE] Step 4a: ❌ Supabase client is null'); return null; }

    const filename = `audio/bug-${Date.now()}.m4a`;
    console.log('[BUG-PIPE] Step 4a: Uploading to bug-recordings bucket, file:', filename);
    const { data, error } = await sb.storage
      .from('bug-recordings')
      .upload(filename, bytes.buffer as ArrayBuffer, { contentType: 'audio/mp4', upsert: false });

    if (error) { console.error('[BUG-PIPE] Step 4a: ❌ Upload FAILED:', error.message); return null; }
    console.log('[BUG-PIPE] Step 4a: ✅ Upload success, path:', data?.path);

    const { data: urlData, error: urlErr } = await sb.storage.from('bug-recordings').createSignedUrl(filename, 60 * 60 * 24 * 7);
    if (urlErr) { console.error('[BUG-PIPE] Step 4a: ❌ Signed URL failed:', urlErr.message); return null; }
    const signedUrl = urlData?.signedUrl ?? null;
    console.log('[BUG-PIPE] Step 4a: ✅ Signed URL (7d TTL):', signedUrl);
    return signedUrl;
  } catch (err) {
    console.error('[BUG-PIPE] Step 4a: ❌ Exception:', err);
    return null;
  }
}

async function uploadFrame(frameUri: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    console.log('[BUG-PIPE] Step 4b: Reading frame:', frameUri);
    const bytes = await readFileAsBytes(frameUri);
    if (!bytes) { console.error('[BUG-PIPE] Step 4b: ❌ Could not read frame'); return null; }

    const sb = getSupabase();
    if (!sb) { console.error('[BUG-PIPE] Step 4b: ❌ Supabase client is null'); return null; }

    const filename = `frames/bug-frame-${Date.now()}.jpg`;
    const { data, error } = await sb.storage
      .from('bug-recordings')
      .upload(filename, bytes.buffer as ArrayBuffer, { contentType: 'image/jpeg', upsert: false });
    if (error) { console.error('[BUG-PIPE] Step 4b: ❌ Frame upload FAILED:', error.message); return null; }

    const { data: urlData, error: urlErr } = await sb.storage.from('bug-recordings').createSignedUrl(filename, 60 * 60 * 24 * 7);
    if (urlErr) { console.error('[BUG-PIPE] Step 4b: ❌ Signed URL failed:', urlErr.message); return null; }
    const signedUrl = urlData?.signedUrl ?? null;
    console.log('[BUG-PIPE] Step 4b: ✅ Frame signed URL (7d TTL):', signedUrl);
    return signedUrl;
  } catch (err) {
    console.error('[BUG-PIPE] Step 4b: ❌ Exception:', err);
    return null;
  }
}

// ─── Submit (INSERT to bug_reports via Supabase client) ───────────────────────

async function submitBugReport(opts: {
  title: string;
  description: string;
  screen: string;
  audioUrl: string | null;
  videoUrl: string | null;
  screenshotUrl: string | null;
  hasVideo: boolean;
  deviceInfo: DeviceInfo;
  consoleLogs: string[];
  breadcrumbs: ReturnType<typeof getBreadcrumbs>;
  frameCount: number;
  elapsed: number;
}): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) { console.error('[BUG-PIPE] Step 4f: ❌ Supabase client is null'); return null; }

  const row = {
    project: PROJECT,
    version: opts.deviceInfo.appVersion,
    app_version: opts.deviceInfo.appVersion,
    title: opts.title,
    description: opts.description || null,
    url: opts.screen,
    user_agent: `${Platform.OS} ${Platform.Version}`,
    session_id: `caps-${Date.now().toString(36)}`,
    status: 'open',
    report_type: 'video',
    has_video: opts.hasVideo,
    audio_url: opts.audioUrl,
    video_url: opts.videoUrl,
    screenshot_url: opts.screenshotUrl,
    device_info: opts.deviceInfo,
    console_logs: opts.consoleLogs,
    breadcrumbs: opts.breadcrumbs,
    metadata: {
      device: opts.deviceInfo.model,
      platform: opts.deviceInfo.platform,
      hasVideo: opts.hasVideo,
      hasAudio: !!opts.audioUrl,
      logCount: opts.consoleLogs.length,
      frameCount: opts.frameCount,
      recordingDuration: opts.elapsed,
      expoVersion: Constants.expoConfig?.sdkVersion ?? '55',
      otaUpdateId: Updates.updateId ?? 'embedded',
      otaChannel: (Updates as any).channel ?? 'production',
    },
  };

  console.log('[BUG-PIPE] Step 4f: INSERT payload summary:', JSON.stringify({
    audio_url: row.audio_url ? 'SET' : 'NULL',
    video_url: row.video_url ? 'SET' : 'NULL',
    screenshot_url: row.screenshot_url ? 'SET' : 'NULL',
    device_info_keys: Object.keys(row.device_info).length,
    console_logs_count: row.console_logs.length,
    breadcrumbs_count: row.breadcrumbs.length,
  }));

  const { data, error } = await sb
    .from('bug_reports')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    console.error('[BUG-PIPE] ❌ INSERT FAILED');
    console.error('[BUG-PIPE] Error message:', error.message);
    console.error('[BUG-PIPE] Error details:', error.details);
    console.error('[BUG-PIPE] Error hint:', error.hint);
    console.error('[BUG-PIPE] Error code:', error.code);
    console.error('[BUG-PIPE] Payload keys:', Object.keys(row).join(', '));
    console.error('[BUG-PIPE] Payload version:', row.version, '| app_version:', row.app_version);
    // Log to error_logs table as fallback for diagnosis
    void sb.from('error_logs').insert({
      context: 'bug_report_insert',
      message: error.message,
      details: JSON.stringify({ code: error.code, hint: error.hint, payload_keys: Object.keys(row) }),
    });
    return null;
  }
  const id = (data as { id: string } | null)?.id ?? null;
  console.log('[BUG-PIPE] Step 4f: ✅ Report saved! ID:', id);
  return id;
}

// ─── AI Triage (runs AFTER insert, only if user typed a description) ─────────
// NOTE: telegram-bot-handler does the REAL triage (with Whisper transcription).
// This inline triage only runs if the user typed a text description — because
// in that case there's no audio to transcribe and we can give a quick result.
// We do NOT call analyze-bug-report — it has an old prompt that reads metadata
// fields and produces garbage output ("tester undefined"), overwriting good data.

async function triggerAITriage(
  reportId: string,
  description: string,
  consoleLogs: string[],
): Promise<{ summary: string; severity: string } | null> {
  // Skip if no description — telegram-bot-handler will do better triage with Whisper
  if (!description.trim()) {
    console.log('[BUG-PIPE] Step 5: No text description — skipping inline triage (Edge Fn will use Whisper)');
    return null;
  }

  const sb = getSupabase();
  if (!sb) return null;

  const logText = consoleLogs.slice(-20).join('\n');
  const Application = require('expo-application');
  const deviceId = (Application?.nativeBuildVersion ?? 'unknown') as string;
  const prompt = `CAPS QA. Classify this bug report.
Console logs (last 20):
${logText}
User description: "${description}"
Reply JSON (no markdown): {"classification":"RELEVANT"|"UNRELATED","summary":"one sentence about the bug","severity":"low"|"medium"|"high"}`;

  try {
    // Route via Supabase Edge Function anthropic-proxy. The Anthropic key
    // never ships in the client. Rate-limited 10 req/min per X-Device-ID.
    const { data: d, error: invokeErr } = await sb.functions.invoke('anthropic-proxy', {
      body: { prompt, model: 'claude-haiku-4-5-20251001', max_tokens: 300 },
      headers: { 'X-Device-ID': deviceId },
    });
    if (!invokeErr && d) {
      const rawText = (d?.content?.[0]?.text ?? '{}').trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      const result = JSON.parse(rawText);
      const summary = typeof result.summary === 'string' ? result.summary : '';
      // Reject if summary looks like metadata garbage
      if (summary && !summary.toLowerCase().includes('undefined') && !summary.toLowerCase().includes('tester')) {
        const sb = getSupabase();
        if (sb) {
          await sb.from('bug_reports').update({
            classification: result.classification === 'UNRELATED' ? 'UNRELATED' : 'RELEVANT',
            ai_summary: summary,
          }).eq('id', reportId);
          console.log('[BUG-PIPE] Step 5: ✅ Inline triage saved. severity:', result.severity, 'summary:', summary.slice(0, 60));
          return { summary, severity: String(result.severity ?? 'medium') };
        }
      } else {
        console.log('[BUG-PIPE] Step 5: Inline triage returned bad output — leaving for Edge Fn to handle');
      }
    }
  } catch (e) {
    console.error('[BUG-PIPE] Step 5: Inline triage failed:', e);
  }
  return null;
}

// ─── Timer Hook ───────────────────────────────────────────────────────────────

function useRecordingTimer(active: boolean) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) { setElapsed(0); return; }
    const iv = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [active]);
  return { elapsed, display: `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}` };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props { children: React.ReactNode; overlayActive?: boolean; }

export function BugReporter({ children, overlayActive = false }: Props) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('idle');
  const [note, setNote] = useState('');
  const [audioAvailable, setAudioAvailable] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const capturedAudioUri = useRef<string | null>(null);
  const capturedFrameCount = useRef(0);
  const capturedLastFrame = useRef<string | null>(null);
  const capturedLogs = useRef<ReturnType<typeof getGlobalLogs>>([]);
  const capturedElapsed = useRef(0);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const { elapsed, display: timerDisplay } = useRecordingTimer(phase === 'recording');

  const dotAnim = useRef(new Animated.Value(1)).current;
  const dotPulseRef = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => {
    if (phase !== 'recording') { dotAnim.setValue(1); dotPulseRef.current?.stop(); return; }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 1.0, duration: 400, useNativeDriver: true }),
      ]),
      { iterations: 999 },
    );
    dotPulseRef.current = pulse;
    pulse.start();
    return () => { pulse.stop(); dotPulseRef.current = null; };
  }, [phase]);

  useEffect(() => { if (Platform.OS !== 'web') requestRecordingPermissionsAsync().catch(() => {}); }, []);

  // Dev ping on mount
  useEffect(() => {
    if (!__DEV__) return;
    const sb = getSupabase();
    if (!sb) return;
    void sb.from('bug_reports').insert({
      project: PROJECT, version: VERSION, title: `[ping] app opened v${VERSION}`,
      description: '[dev ping]', url: 'mount', status: 'open', report_type: 'text',
      metadata: { dev: true },
    });
  }, []);

  const showToast = useCallback((msg: string, durationMs = 2500) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), durationMs);
  }, []);

  // Track navigation breadcrumbs
  const pathname = usePathname();
  const path = pathname ?? '';
  useEffect(() => { addBreadcrumb(path); }, [path]);

  // ── Audio (expo-audio hook — expo-av NOT used: was removed in S75, native binary lacks it) ──

  async function startAudio() {
    if (Platform.OS === 'web') return;
    console.log('[BUG-AUDIO] Step 2b: Configuring audio mode for recording...');
    try {
      await withTimeout(
        setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true }),
        15000,
        undefined,
        'set-audio-mode'
      );
      console.log('[BUG-AUDIO] Step 2b: ✅ Audio mode set');
    } catch (err) {
      console.warn('[BugReporter] audio failed: setAudioModeAsync error:', err);
      return;
    }
    console.log('[BUG-AUDIO] Step 2b: Preparing recorder...');
    try {
      await withTimeout(
        audioRecorder.prepareToRecordAsync(),
        15000,
        undefined,
        'prepare-recorder'
      );
      console.log('[BUG-AUDIO] Step 2b: ✅ Prepared');
      audioRecorder.record();
      console.log('[BUG-AUDIO] Step 2b: ✅ record() called');
      setAudioAvailable(true);
    } catch (err) {
      console.warn('[BugReporter] audio failed: prepareToRecordAsync/record error:', err);
      setAudioAvailable(false);
    }
  }

  async function stopAudio(): Promise<string | null> {
    if (!audioAvailable) {
      console.log('[BUG-PIPE] Step 3b: stopAudio skipped (audioAvailable=false)');
      return null;
    }
    try {
      console.log('[BUG-PIPE] Step 3b: Stopping recorder...');
      await audioRecorder.stop();
      const uri = audioRecorder.uri ?? null;
      console.log('[BUG-PIPE] Step 3b:', uri ? `✅ Audio URI: ${uri}` : '❌ NO AUDIO URI — stop() returned no uri');
      setAudioAvailable(false);
      return uri;
    } catch (err) {
      console.error('[BUG-PIPE] Step 3b: ❌ stopAudio FAILED:', err);
      setAudioAvailable(false);
      return null;
    }
  }

  // ── Pill Show ──────────────────────────────────────────────────────────────

  const isGameScreen = ['/game', '/multiplayer-game', '/orientation-pick'].includes(path) || path.startsWith('/lobby');
  const fabBottom = pathname === '/' ? insets.bottom + 60 : insets.bottom + 16;

  const openReporter = useCallback(async () => {
    if (phase !== 'idle') return;
    track('bug_reporter_opened', {}, 'bug_reporter');
    console.log('[BUG-PIPE] Step 1: User triggered bug report — showing pill...');
    playHaptic('medium');
    setNote('');
    setPhase('recording');

    console.log('[BUG-PIPE] Step 2a: Starting screen capture...');
    const [started] = await Promise.all([startRecording(), startAudio()]);
    if (!started) console.log('[BUG-PIPE] Step 2a: Screen recording skipped (no captureScreen or web)');
    else console.log('[BUG-PIPE] Step 2a: ✅ Screen capture started');

    autoStopRef.current = setTimeout(() => handleStop(true), MAX_AUTO_STOP_S * 1000);
  }, [phase]);

  // ── Stop ───────────────────────────────────────────────────────────────────

  const handleStop = useCallback(async (_autoStopped = false) => {
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    console.log('[BUG-PIPE] Step 3: Stopping all recordings...');
    const [, audioUri, frames] = await Promise.all([stopRecording(), withTimeout(stopAudio(), 8000, null, 'stop-audio'), getLastCrashScreenshots()]);
    console.log('[BUG-PIPE] Step 3a: Screen capture stopped. Total frames:', frames.length);
    capturedAudioUri.current = audioUri;
    capturedFrameCount.current = frames.length;
    capturedLastFrame.current = frames.length > 0 ? frames[frames.length - 1] : null;
    capturedLogs.current = getGlobalLogs();
    capturedElapsed.current = elapsed;
    console.log('[BUG-PIPE] Step 3c: Submit dialog shown. audioUri:', audioUri ? 'SET' : 'NULL', 'frames:', frames.length);
    playHaptic('light');
    setPhase('review');
  }, [stopAudio, elapsed]);

  // ── Send ───────────────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const noteToSend = note.trim();
    const audioUri = capturedAudioUri.current;
    const frameCount = capturedFrameCount.current;
    const lastFrame = capturedLastFrame.current;
    const recordingElapsed = capturedElapsed.current;
    setPhase('idle');
    setNote('');
    showToast('Sending...');

    (async () => {
      try {
        // 4a: Upload audio — 10s timeout
        console.log('[BUG-PIPE] Step 4a: Uploading audio... audioUri=', audioUri ? 'SET' : 'NULL');
        const audioUrl = audioUri
          ? await withTimeout(uploadAudio(audioUri), 10000, null, 'upload-audio')
          : null;
        console.log('[BUG-PIPE] Step 4a: audioUrl=', audioUrl ? 'SET' : 'NULL (timeout/fail)');

        // 4b: Upload last frame — 5s timeout
        console.log('[BUG-PIPE] Step 4b: Uploading screenshot... lastFrame=', lastFrame ? 'SET' : 'NULL');
        const videoUrl = lastFrame
          ? await withTimeout(uploadFrame(lastFrame), 5000, null, 'upload-frame')
          : null;
        console.log('[BUG-PIPE] Step 4b: videoUrl=', videoUrl ? 'SET' : 'NULL (timeout/fail)');

        // 4c: Collect device info
        console.log('[BUG-PIPE] Step 4c: Collecting device info...');
        const deviceInfo = collectDeviceInfo();
        console.log('[BUG-PIPE] Step 4c: ✅', JSON.stringify(deviceInfo));

        // 4d: Collect console logs — getAllLogs() for DB record, getGameLogs() for AI triage
        console.log('[BUG-PIPE] Step 4d: Collecting console logs...');
        const consoleLogs = getConsoleLogs();   // game + pipeline (labeled) → DB record
        const gameLogsForAI = getGameLogs();    // game-only → AI triage (no pipeline noise)
        console.log('[BUG-PIPE] Step 4d: ✅', consoleLogs.length, 'total |', gameLogsForAI.length, 'game logs');

        // 4e: Collect breadcrumbs
        console.log('[BUG-PIPE] Step 4e: Collecting breadcrumbs...');
        const crumbs = getBreadcrumbs();
        console.log('[BUG-PIPE] Step 4e: ✅', crumbs.length, 'entries');

        // 4f: INSERT to Supabase
        console.log('[BUG-PIPE] Step 4f: Inserting report to Supabase...');
        const reportId = await withTimeout(submitBugReport({
          title: noteToSend || 'Bug recorded',
          description: noteToSend,
          screen: path || 'unknown',
          audioUrl,
          videoUrl,
          screenshotUrl: videoUrl,
          hasVideo: frameCount > 0,
          deviceInfo,
          consoleLogs,
          breadcrumbs: crumbs,
          frameCount,
          elapsed: recordingElapsed,
        }), 5000, null, 'insert-report');
        console.log('[BUG-PIPE] Step 4f: reportId=', reportId ? reportId : 'NULL (timeout/fail)');

        // 5: AI triage — await inline result for WhatsApp message, edge fn is fire-and-forget
        let aiSummary: string | null = null;
        let aiSeverity: string | null = null;
        if (reportId) {
          console.log('[BUG-PIPE] Step 5: Triggering AI triage for report ID:', reportId);
          const aiResult = await withTimeout(
            triggerAITriage(reportId, noteToSend, gameLogsForAI),
            8000,
            null,
            'ai-triage',
          );
          aiSummary = aiResult?.summary ?? null;
          aiSeverity = aiResult?.severity ?? null;
          console.log('[BUG-PIPE] Step 5: aiSummary=', aiSummary ? aiSummary.slice(0, 60) : 'NULL');
        }

        // 6: WhatsApp + ntfy notification
        if (reportId) {
          console.log('[BUG-PIPE] Step 6: Sending WhatsApp notification...');
          const fixPrompt = buildBugFixPrompt({
            reportId,
            aiSummary,
            aiSeverity,
            consoleLogs,
            crumbs,
          });
          await withTimeout(
            sendBugReportToWhatsApp({
              reportId,
              aiSummary,
              aiSeverity,
              description: noteToSend || null,
              deviceModel: deviceInfo.model,
              deviceOsVersion: deviceInfo.osVersion,
              deviceBuildNumber: deviceInfo.buildNumber,
              audioUrl,
              videoUrl,
              logCount: consoleLogs.length,
              crumbCount: crumbs.length,
              frameCount,
              elapsed: recordingElapsed,
              fixPrompt,
            }),
            8000,
            undefined,
            'whatsapp-notification',
          );
          console.log('[BUG-PIPE] Step 6: ✅ WhatsApp sent');
        }

        // 7: Cleanup temp files
        console.log('[BUG-PIPE] Step 7: Cleaning up temp files...');
        const FileSystem = Platform.OS !== 'web' ? (() => { try { return require('expo-file-system'); } catch { return null; } })() : null;
        if (FileSystem) {
          if (audioUri) FileSystem.deleteAsync(audioUri, { idempotent: true }).catch(() => {});
          if (lastFrame) FileSystem.deleteAsync(lastFrame, { idempotent: true }).catch(() => {});
        }

        // Reset capture refs
        capturedAudioUri.current = null;
        capturedFrameCount.current = 0;
        capturedLastFrame.current = null;
        capturedLogs.current = [];
        capturedElapsed.current = 0;
        console.log('[BUG-PIPE] Step 7: ✅ Cleanup complete');

        playHaptic('success');
        showToast(reportId ? 'Report sent ✅' : 'Sent (upload issue) ⚠️');
      } catch (err) {
        console.error('[BUG-PIPE] ❌ handleSend failed:', err);
        showToast('Failed to send ❌');
      }
    })();
  }, [note, path, showToast]);

  // ── Discard ────────────────────────────────────────────────────────────────

  const handleDiscard = useCallback(async () => {
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    if (phase === 'recording') await Promise.all([stopRecording(), stopAudio()]);
    capturedAudioUri.current = null;
    capturedFrameCount.current = 0;
    capturedLastFrame.current = null;
    capturedLogs.current = [];
    capturedElapsed.current = 0;
    setNote('');
    setPhase('idle');
  }, [phase, stopAudio]);

  useShakeDetection(openReporter, phase === 'idle');

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1 }}>
      {children}

      {__DEV__ && phase === 'idle' && !overlayActive && !isGameScreen && (
        <TouchableOpacity style={[styles.fab, { bottom: fabBottom }]} onPress={openReporter} activeOpacity={0.7} accessibilityLabel="Record bug">
          <Text style={styles.fabText}>{'🐛'}</Text>
        </TouchableOpacity>
      )}

      {phase === 'recording' && (
        <TouchableOpacity
          style={[styles.pill, { bottom: insets.bottom + 12, right: 12 }]}
          onPress={() => handleStop(false)}
          activeOpacity={0.85}
          accessibilityLabel="Stop recording"
        >
          <Animated.View style={[styles.recDot, { opacity: dotAnim }]} />
          <Text style={styles.pillTimer}>REC {timerDisplay}</Text>
          <Text style={styles.pillStop}>{'⏹'}</Text>
          {elapsed >= MAX_AUTO_STOP_S - 10 && (
            <Text style={styles.pillCountdown}>{MAX_AUTO_STOP_S - elapsed}s</Text>
          )}
        </TouchableOpacity>
      )}

      {toastMsg ? (
        <View style={[styles.toast, { top: insets.top + 8 }]} pointerEvents="none">
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      ) : null}

      <Modal visible={phase === 'review'} animationType="slide" transparent onRequestClose={handleDiscard}>
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={Keyboard.dismiss}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.sheetTitle}>{'🐛'} Bug Report</Text>
            <Text style={styles.sheetSub}>
              {capturedAudioUri.current ? '🎙 Audio ✅' : '🎙 No audio'}
              {capturedFrameCount.current > 0 ? `  ·  ${capturedFrameCount.current} frames` : ''}
            </Text>
            {capturedLastFrame.current ? (
              <ScrollView style={styles.screenshotScroll} contentContainerStyle={{ alignItems: 'center' }}>
                <Image
                  source={{ uri: capturedLastFrame.current }}
                  style={styles.screenshotPreview}
                  resizeMode="contain"
                />
              </ScrollView>
            ) : null}
            <TextInput
              style={styles.noteInput}
              placeholder="What happened? (optional)"
              placeholderTextColor="#78716C"
              value={note}
              onChangeText={setNote}
              maxLength={300}
              multiline
              numberOfLines={3}
              returnKeyType="done"
              textAlignVertical="top"
              autoFocus
            />
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.discardBtn} onPress={handleDiscard}>
                <Text style={styles.discardBtnText}>DISCARD</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sendBtn} onPress={handleSend} activeOpacity={0.8}>
                <Text style={styles.sendBtnText}>SEND {'✓'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute', bottom: 80, right: 16, width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#c96a1a', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    shadowColor: '#c96a1a', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 999,
  },
  fabText: { fontSize: 20 },
  pill: {
    position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.75)', borderWidth: 1, borderColor: 'rgba(255,68,68,0.6)',
    zIndex: 10000, shadowColor: '#ff4444', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 1000,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff4444' },
  pillTimer: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  pillStop: { color: '#fff', fontSize: 14, marginLeft: 2 },
  pillCountdown: { color: '#ff8888', fontSize: 10, fontWeight: '600' },
  toast: {
    position: 'absolute', alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)', paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 20, zIndex: 10001,
  },
  toastText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0d0700', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 16, paddingHorizontal: 16, borderTopWidth: 1, borderColor: '#3d2a1a',
  },
  sheetTitle: { color: '#f5e6d3', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  sheetSub: { color: '#78716C', fontSize: 12, marginBottom: 14 },
  noteInput: {
    backgroundColor: '#1a0e06', borderRadius: 10, borderWidth: 1, borderColor: '#3d2a1a',
    paddingHorizontal: 14, paddingVertical: 10, color: '#f5e6d3', fontSize: 14,
    marginBottom: 14, minHeight: 70,
  },
  btnRow: { flexDirection: 'row', gap: 10 },
  discardBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#3d2a1a', alignItems: 'center' },
  discardBtnText: { color: '#78716C', fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  sendBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: '#ff4444', alignItems: 'center' },
  sendBtnText: { color: '#000', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  screenshotScroll: { width: '100%', maxHeight: 160, marginBottom: 10 },
  screenshotPreview: { width: '100%', height: 150, borderRadius: 8, borderWidth: 1, borderColor: '#3d2a1a' },
});
