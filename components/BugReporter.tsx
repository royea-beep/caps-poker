/**
 * BugReporter for CAPS Poker -- S80 Background Mode
 *
 * Flow: FAB/shake -> start recordings -> floating pill (game stays playable)
 *       Tap pill -> minimal bottom sheet -> Send / Discard
 *       Send -> background upload -> toast confirmations
 *
 * ZERO Reanimated -- RN Animated for dot pulse only (iron rule).
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

let Haptics: typeof import('expo-haptics') | null = null;
if (Platform.OS !== 'web') { try { Haptics = require('expo-haptics'); } catch {} }

const PROJECT = 'caps-poker';
const VERSION = Constants.expoConfig?.version ?? '1.9.4';
const MAX_AUTO_STOP_S = 60;
type Phase = 'idle' | 'recording' | 'review';

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

interface TriageResult { classification: 'RELEVANT' | 'UNRELATED' | 'PENDING'; summary: string; }

async function classifyBugReport(logs: ReturnType<typeof getGlobalLogs>, note: string): Promise<TriageResult> {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) return { classification: 'PENDING', summary: 'No API key' };
  try {
    const logText = logs.slice(-20).map((l, i) => `[${i + 1}] ${l.time} ${l.message}`).join('\n');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, messages: [{ role: 'user', content: `CAPS QA. RELEVANT or UNRELATED bug.
Log:
${logText}
Note: "${note}"
JSON: {"classification":"RELEVANT"|"UNRELATED","summary":"..."}` }] }),
    });
    if (!res.ok) return { classification: 'PENDING', summary: `HTTP ${res.status}` };
    const data = await res.json();
    const result = JSON.parse(data.content?.[0]?.text ?? '{}');
    return { classification: result.classification === 'UNRELATED' ? 'UNRELATED' : 'RELEVANT', summary: typeof result.summary === 'string' ? result.summary : '' };
  } catch { return { classification: 'PENDING', summary: 'Triage error' }; }
}

async function uploadAudio(uri: string, supabaseUrl: string, supabaseKey: string): Promise<string | null> {
  try {
    const blob = await (await fetch(uri)).blob();
    const filename = `bug-audio-${Date.now()}.m4a`;
    const res = await fetch(`${supabaseUrl}/storage/v1/object/bug-recordings/${filename}`, {
      method: 'POST',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'audio/m4a' },
      body: blob,
    });
    return res.ok ? `${supabaseUrl}/storage/v1/object/public/bug-recordings/${filename}` : null;
  } catch { return null; }
}

async function submitBugReport(
  title: string, description: string, screen: string,
  logs: ReturnType<typeof getGlobalLogs>, triage: TriageResult, hasVideo: boolean, audioUrl: string | null,
): Promise<void> {
  const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || extra?.supabaseUrl;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra?.supabaseAnonKey;
  if (!url || !key) { debugLog('[BugReporter] Supabase not configured', 'warn'); return; }
  const logSnapshot = logs.slice(-50).map((l) => `${l.time} ${l.message}`).join('\n');
  const row: Record<string, unknown> = {
    project: PROJECT, version: VERSION, title,
    description: description || logSnapshot.slice(0, 500) || null,
    url: screen, user_agent: `${Platform.OS} ${Platform.Version}`,
    session_id: `caps-${Date.now().toString(36)}`,
    metadata: { device: Constants.deviceName || 'unknown', platform: Platform.OS, expoVersion: Constants.expoConfig?.sdkVersion, logCount: logs.length, hasVideo },
    status: 'open', report_type: 'video', classification: triage.classification,
    ai_summary: triage.summary, needs_review: triage.classification === 'UNRELATED',
    has_video: hasVideo, audio_url: audioUrl,
  };
  const res = await fetch(`${url}/rest/v1/bug_reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=headers-only' },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  const idMatch = (res.headers.get('location') || '').match(/id=eq.([^&]+)/);
  if (typeof globalThis.__bugReporterScreenshot === 'string') globalThis.__bugReporterScreenshot = undefined;
  fetch(`${url}/functions/v1/analyze-bug-report`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key },
    body: JSON.stringify({ bug_report_id: idMatch?.[1] ?? null, description: `${title}${description ? ' -- ' + description : ''}`, report_type: 'video', tester_name: 'Anonymous', app_version: VERSION, language: 'he', project_name: 'Caps', github_repo: 'royea-beep/caps', breadcrumbs: logs.slice(-10).map((l) => ({ message: l.message, timestamp: l.time })), base_url: 'https://caps.ftable.co.il' }),
  }).catch(() => {});
}

function useRecordingTimer(active: boolean) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) { setElapsed(0); return; }
    const iv = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [active]);
  return { elapsed, display: `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}` };
}

interface Props { children: React.ReactNode; overlayActive?: boolean; }

export function BugReporter({ children, overlayActive = false }: Props) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('idle');
  const [note, setNote] = useState('');
  const [audioAvailable, setAudioAvailable] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const capturedAudioUri = useRef<string | null>(null);
  const capturedFrameCount = useRef(0);
  const capturedLogs = useRef<ReturnType<typeof getGlobalLogs>>([]);
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
      { iterations: 999 }
    );
    dotPulseRef.current = pulse;
    pulse.start();
    return () => { pulse.stop(); dotPulseRef.current = null; };
  }, [phase]);

  useEffect(() => { if (Platform.OS !== 'web') requestRecordingPermissionsAsync().catch(() => {}); }, []);
  useEffect(() => {
    if (!__DEV__) return;
    submitBugReport(`[ping] app opened v${VERSION}`, '[dev ping]', 'mount', [], { classification: 'UNRELATED', summary: 'dev ping' }, false, null).catch(() => {});
  }, []);

  const showToast = useCallback((msg: string, durationMs = 2500) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), durationMs);
  }, []);

  async function startAudio() {
    if (Platform.OS === 'web') return;
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setAudioAvailable(true);
    } catch { setAudioAvailable(false); }
  }

  async function stopAudio(): Promise<string | null> {
    if (!audioAvailable) return null;
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri ?? null;
      setAudioAvailable(false);
      return uri;
    } catch { return null; }
  }

  const pathname = usePathname();
  const path = pathname ?? '';
  const isGameScreen = ['/game', '/multiplayer-game', '/sit-and-go', '/tournament', '/orientation-pick'].includes(path) || path.startsWith('/lobby');
  const fabBottom = pathname === '/' ? insets.bottom + 60 : insets.bottom + 16;

  const openReporter = useCallback(async () => {
    if (phase !== 'idle') return;
    Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Medium)?.catch?.(() => {});
    setNote('');
    setPhase('recording');
    const [started] = await Promise.all([startRecording(), startAudio()]);
    if (!started) debugLog('[BugReporter] Screen recording failed -- audio-only');
    autoStopRef.current = setTimeout(() => handleStop(true), MAX_AUTO_STOP_S * 1000);
  }, [phase]);

  const handleStop = useCallback(async (_autoStopped = false) => {
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    const [, audioUri, frames] = await Promise.all([stopRecording(), stopAudio(), getLastCrashScreenshots()]);
    capturedAudioUri.current = audioUri;
    capturedFrameCount.current = frames.length;
    capturedLogs.current = getGlobalLogs();
    Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Light)?.catch?.(() => {});
    setPhase('review');
  }, [stopAudio]);

  const handleSend = useCallback(async () => {
    const noteToSend = note.trim();
    const audioUri = capturedAudioUri.current;
    const frameCount = capturedFrameCount.current;
    const logs = capturedLogs.current;
    setPhase('idle');
    setNote('');
    showToast('Sending...');
    (async () => {
      try {
        const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || extra?.supabaseUrl || '';
        const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra?.supabaseAnonKey || '';
        const audioUrl = audioUri ? await uploadAudio(audioUri, supabaseUrl, supabaseKey) : null;
        let triage: TriageResult = { classification: 'PENDING', summary: 'Classifying...' };
        try {
          triage = await Promise.race([
            classifyBugReport(logs, noteToSend),
            new Promise<TriageResult>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
          ]);
        } catch { triage = { classification: 'PENDING', summary: 'Triage timeout' }; }
        await submitBugReport(noteToSend || 'Bug recorded', noteToSend, pathname || 'unknown', logs, triage, frameCount > 0, audioUrl);
        Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType.Success)?.catch?.(() => {});
        showToast('Report sent ✅');
      } catch { showToast('Failed to send ❌'); }
    })();
  }, [note, pathname, showToast]);

  const handleDiscard = useCallback(async () => {
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    if (phase === 'recording') await Promise.all([stopRecording(), stopAudio()]);
    capturedAudioUri.current = null;
    capturedFrameCount.current = 0;
    capturedLogs.current = [];
    setNote('');
    setPhase('idle');
  }, [phase, stopAudio]);

  useShakeDetection(openReporter, phase === 'idle');

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
