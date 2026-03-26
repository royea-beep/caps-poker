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
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Modal, Platform, Keyboard, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import Constants from 'expo-constants';
import { getGlobalLogs, debugLog } from './DebugOverlay';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { startRecording, stopRecording, getLastCrashScreenshots } from '../utils/screenRecorder';
import { getSupabase } from '../utils/supabase';
import { getConsoleLogs } from '../utils/logBuffer';
import { getBreadcrumbs, addBreadcrumb } from '../utils/breadcrumbs';

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

async function readFileAsBytes(uri: string): Promise<Uint8Array | null> {
  try {
    // GEM-13: fetch(file://).blob() fails silently on iOS — use FileSystem Base64
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const FileSystem = require('expo-file-system');
    const base64: string = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    console.log('[BUG-PIPE] readFileAsBytes: base64 length', base64.length);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    console.log('[BUG-PIPE] readFileAsBytes: Uint8Array size', bytes.length, 'bytes');
    return bytes;
  } catch (err) {
    console.error('[BUG-PIPE] ❌ readFileAsBytes failed:', err);
    return null;
  }
}

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
      .upload(filename, bytes, { contentType: 'audio/mp4', upsert: false });

    if (error) { console.error('[BUG-PIPE] Step 4a: ❌ Upload FAILED:', error.message); return null; }
    console.log('[BUG-PIPE] Step 4a: ✅ Upload success, path:', data?.path);

    const { data: urlData } = sb.storage.from('bug-recordings').getPublicUrl(filename);
    const publicUrl = urlData?.publicUrl ?? null;
    console.log('[BUG-PIPE] Step 4a: ✅ Public URL:', publicUrl);
    return publicUrl;
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
      .upload(filename, bytes, { contentType: 'image/jpeg', upsert: false });
    if (error) { console.error('[BUG-PIPE] Step 4b: ❌ Frame upload FAILED:', error.message); return null; }

    const { data: urlData } = sb.storage.from('bug-recordings').getPublicUrl(filename);
    const publicUrl = urlData?.publicUrl ?? null;
    console.log('[BUG-PIPE] Step 4b: ✅ Frame uploaded:', publicUrl);
    return publicUrl;
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
    console.error('[BUG-PIPE] Step 4f: ❌ INSERT FAILED:', error.message);
    return null;
  }
  const id = (data as { id: string } | null)?.id ?? null;
  console.log('[BUG-PIPE] Step 4f: ✅ Report saved! ID:', id);
  return id;
}

// ─── AI Triage (runs AFTER insert, fire-and-forget) ───────────────────────────

async function triggerAITriage(
  reportId: string,
  description: string,
  consoleLogs: string[],
): Promise<void> {
  const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || extra?.supabaseUrl;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra?.supabaseAnonKey;
  if (!url || !key) return;

  const logText = consoleLogs.slice(-20).join('\n');
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;

  // Try inline Claude Haiku triage first (fast)
  if (apiKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001', max_tokens: 300,
          messages: [{ role: 'user', content: `CAPS QA. Classify this bug report.
Console logs (last 20):
${logText}
Description: "${description}"
Reply JSON: {"classification":"RELEVANT"|"UNRELATED","summary":"one sentence","severity":"low"|"medium"|"high"}` }],
        }),
      });
      if (res.ok) {
        const d = await res.json();
        const result = JSON.parse(d.content?.[0]?.text ?? '{}');
        const sb = getSupabase();
        if (sb) {
          await sb.from('bug_reports').update({
            classification: result.classification === 'UNRELATED' ? 'UNRELATED' : 'RELEVANT',
            ai_summary: typeof result.summary === 'string' ? result.summary : '',
          }).eq('id', reportId);
          console.log('[BUG-PIPE] Step 5: ✅ AI triage saved. severity:', result.severity, 'summary:', result.summary);
        }
      }
    } catch (e) {
      console.error('[BUG-PIPE] Step 5: Inline triage failed, trying edge function:', e);
    }
  }

  // Also call edge function (it can do deeper analysis with full row from DB)
  fetch(`${url}/functions/v1/analyze-bug-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key },
    body: JSON.stringify({
      bug_report_id: reportId,
      description,
      report_type: 'video',
      app_version: VERSION,
      language: 'he',
      project_name: 'Caps',
      github_repo: 'royea-beep/caps',
      breadcrumbs: getBreadcrumbs().slice(-10).map((c) => ({ message: c.screen, timestamp: c.ts })),
      base_url: 'https://caps.ftable.co.il',
    }),
  }).catch(() => {});
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

  // ── Audio ──────────────────────────────────────────────────────────────────

  async function startAudio() {
    if (Platform.OS === 'web') return;
    try {
      console.log('[BUG-PIPE] Step 2b: Configuring audio mode for recording...');
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      console.log('[BUG-PIPE] Step 2b: ✅ Audio mode configured');
      await audioRecorder.prepareToRecordAsync();
      console.log('[BUG-PIPE] Step 2b: ✅ Recorder prepared');
      audioRecorder.record();
      console.log('[BUG-PIPE] Step 2b: ✅ Audio recording started');
      setAudioAvailable(true);
    } catch (err) {
      console.error('[BUG-PIPE] Step 2b: ❌ startAudio failed:', err);
      setAudioAvailable(false);
    }
  }

  async function stopAudio(): Promise<string | null> {
    if (!audioAvailable) {
      console.log('[BUG-PIPE] Step 3b: stopAudio skipped (audioAvailable=false)');
      return null;
    }
    try {
      console.log('[BUG-PIPE] Step 3b: Stopping audio recorder...');
      await audioRecorder.stop();
      const uri = audioRecorder.uri ?? null;
      console.log('[BUG-PIPE] Step 3b:', uri ? `✅ Audio URI: ${uri}` : '❌ NO AUDIO URI — recording may not have started');
      setAudioAvailable(false);
      return uri;
    } catch (err) {
      console.error('[BUG-PIPE] Step 3b: ❌ stopAudio failed:', err);
      return null;
    }
  }

  // ── Pill Show ──────────────────────────────────────────────────────────────

  const isGameScreen = ['/game', '/multiplayer-game', '/sit-and-go', '/tournament', '/orientation-pick'].includes(path) || path.startsWith('/lobby');
  const fabBottom = pathname === '/' ? insets.bottom + 60 : insets.bottom + 16;

  const openReporter = useCallback(async () => {
    if (phase !== 'idle') return;
    console.log('[BUG-PIPE] Step 1: User triggered bug report — showing pill...');
    Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Medium)?.catch?.(() => {});
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
    const [, audioUri, frames] = await Promise.all([stopRecording(), stopAudio(), getLastCrashScreenshots()]);
    console.log('[BUG-PIPE] Step 3a: Screen capture stopped. Total frames:', frames.length);
    capturedAudioUri.current = audioUri;
    capturedFrameCount.current = frames.length;
    capturedLastFrame.current = frames.length > 0 ? frames[frames.length - 1] : null;
    capturedLogs.current = getGlobalLogs();
    capturedElapsed.current = elapsed;
    console.log('[BUG-PIPE] Step 3c: Submit dialog shown. audioUri:', audioUri ? 'SET' : 'NULL', 'frames:', frames.length);
    Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Light)?.catch?.(() => {});
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
        // 4a: Upload audio
        console.log('[BUG-PIPE] Step 4a: Uploading audio... audioUri=', audioUri ? 'SET' : 'NULL');
        const audioUrl = audioUri ? await uploadAudio(audioUri) : null;

        // 4b: Upload last frame
        console.log('[BUG-PIPE] Step 4b: Uploading screenshot... lastFrame=', lastFrame ? 'SET' : 'NULL');
        const videoUrl = lastFrame ? await uploadFrame(lastFrame) : null;

        // 4c: Collect device info
        console.log('[BUG-PIPE] Step 4c: Collecting device info...');
        const deviceInfo = collectDeviceInfo();
        console.log('[BUG-PIPE] Step 4c: ✅', JSON.stringify(deviceInfo));

        // 4d: Collect console logs
        console.log('[BUG-PIPE] Step 4d: Collecting console logs...');
        const consoleLogs = getConsoleLogs();
        console.log('[BUG-PIPE] Step 4d: ✅', consoleLogs.length, 'lines');

        // 4e: Collect breadcrumbs
        console.log('[BUG-PIPE] Step 4e: Collecting breadcrumbs...');
        const crumbs = getBreadcrumbs();
        console.log('[BUG-PIPE] Step 4e: ✅', crumbs.length, 'entries');

        // 4f: INSERT to Supabase
        console.log('[BUG-PIPE] Step 4f: Inserting report to Supabase...');
        const reportId = await submitBugReport({
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
        });

        if (reportId) {
          // 5: AI triage — runs AFTER insert so the DB row has all the data
          console.log('[BUG-PIPE] Step 5: Triggering AI triage for report ID:', reportId);
          triggerAITriage(reportId, noteToSend, consoleLogs).catch(() => {});
        }

        // 6: Cleanup temp files
        console.log('[BUG-PIPE] Step 6: Cleaning up temp files...');
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
        console.log('[BUG-PIPE] Step 6: ✅ Cleanup complete');

        Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType.Success)?.catch?.(() => {});
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

      {phase === 'idle' && !overlayActive && !isGameScreen && (
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
});
