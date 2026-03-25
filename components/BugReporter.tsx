/**
 * BugReporter for CAPS Poker — S75 Enhanced Version
 * Shake / FAB → recording overlay → live debug log stream → STOP & SEND
 * → screen frames captured + expo-av audio + Claude AI triage → Supabase bug_reports
 *
 * ZERO Reanimated — RN Animated only for dot pulse.
 * Audio: expo-av Audio.Recording → .m4a → Supabase Storage (bug-recordings bucket)
 */

declare global {
  // eslint-disable-next-line no-var
  var __bugReporterScreenshot: string | undefined;
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, Modal,
  ActivityIndicator, Platform, Keyboard, FlatList, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import Constants from 'expo-constants';
import { getGlobalLogs, debugLog } from './DebugOverlay';
import { Audio } from 'expo-av';
import { startRecording, stopRecording, getLastCrashScreenshots } from '../utils/screenRecorder';

let Haptics: typeof import('expo-haptics') | null = null;
if (Platform.OS !== 'web') { try { Haptics = require('expo-haptics'); } catch {} }

const PROJECT = 'caps-poker';
const VERSION = Constants.expoConfig?.version ?? '1.9.4';
const MAX_AUTO_STOP_S = 60;

// ── Shake Detection ─────────────────────────────────────────────────────────

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

// ── AI Triage ───────────────────────────────────────────────────────────────

interface TriageResult {
  classification: 'RELEVANT' | 'UNRELATED' | 'PENDING';
  summary: string;
}

async function classifyBugReport(logs: ReturnType<typeof getGlobalLogs>, note: string): Promise<TriageResult> {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) return { classification: 'PENDING', summary: 'No API key' };
  try {
    const logText = logs.slice(-20).map((l, i) => `[${i + 1}] ${l.time} ${l.message}`).join('\n');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `You are a QA analyst for a poker app called CAPS.\n\nA tester submitted a bug report. Classify it as RELEVANT or UNRELATED.\n\nRELEVANT = real bug, unexpected behavior, crash, or visual issue IN THE APP.\nUNRELATED = off-topic, testing the recorder, silence, accidental recording.\n\nDebug log (last 20 entries):\n${logText}\n\nText note: "${note}"\n\nRespond ONLY with JSON: {"classification":"RELEVANT"|"UNRELATED","summary":"one sentence","confidence":0.0}`,
        }],
      }),
    });
    if (!res.ok) return { classification: 'PENDING', summary: `HTTP ${res.status}` };
    const data = await res.json();
    const text = data.content?.[0]?.text ?? '{}';
    const result = JSON.parse(text);
    return {
      classification: result.classification === 'UNRELATED' ? 'UNRELATED' : 'RELEVANT',
      summary: typeof result.summary === 'string' ? result.summary : '',
    };
  } catch {
    return { classification: 'PENDING', summary: 'Triage error' };
  }
}

// ── Supabase Submit ──────────────────────────────────────────────────────────

async function uploadAudio(uri: string, supabaseUrl: string, supabaseKey: string): Promise<string | null> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const filename = `bug-audio-${Date.now()}.m4a`;
    const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/bug-recordings/${filename}`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'audio/m4a',
      },
      body: blob,
    });
    if (!uploadRes.ok) return null;
    return `${supabaseUrl}/storage/v1/object/public/bug-recordings/${filename}`;
  } catch {
    return null;
  }
}

async function submitBugReport(
  title: string,
  description: string,
  screen: string,
  logs: ReturnType<typeof getGlobalLogs>,
  triage: TriageResult,
  hasVideo: boolean,
  audioUrl: string | null,
): Promise<void> {
  const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || extra?.supabaseUrl;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra?.supabaseAnonKey;
  if (!url || !key) { debugLog('[BugReporter] Supabase not configured', 'warn'); return; }

  const logSnapshot = logs.slice(-50).map((l) => `${l.time} ${l.message}`).join('\n');

  const row: Record<string, unknown> = {
    project: PROJECT,
    version: VERSION,
    title,
    description: description || logSnapshot.slice(0, 500) || null,
    url: screen,
    user_agent: `${Platform.OS} ${Platform.Version}`,
    session_id: `caps-${Date.now().toString(36)}`,
    metadata: {
      device: Constants.deviceName || 'unknown',
      platform: Platform.OS,
      expoVersion: Constants.expoConfig?.sdkVersion,
      logCount: logs.length,
      hasVideo,
    },
    status: 'open',
    report_type: 'video',
    // New S74/S75 columns (gracefully ignored if migration not applied):
    classification: triage.classification,
    ai_summary: triage.summary,
    needs_review: triage.classification === 'UNRELATED',
    has_video: hasVideo,
    audio_url: audioUrl,
  };

  const res = await fetch(`${url}/rest/v1/bug_reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'return=headers-only',
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`${res.status}`);

  // Pass screenshot to Drive sync via global
  const location = res.headers.get('location') || '';
  const idMatch = location.match(/id=eq\.([^&]+)/);
  const bugReportId = idMatch ? idMatch[1] : null;

  if (typeof globalThis.__bugReporterScreenshot === 'string') {
    globalThis.__bugReporterScreenshot = undefined;
  }

  fetch(`${url}/functions/v1/analyze-bug-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key },
    body: JSON.stringify({
      bug_report_id: bugReportId,
      description: `${title}${description ? ' — ' + description : ''}`,
      report_type: 'video',
      tester_name: 'Anonymous',
      app_version: VERSION,
      language: 'he',
      project_name: 'Caps',
      github_repo: 'royea-beep/caps',
      breadcrumbs: logs.slice(-10).map((l) => ({ message: l.message, timestamp: l.time })),
      base_url: 'https://caps.ftable.co.il',
    }),
  }).catch(() => {});
}

// ── Recording Hook ───────────────────────────────────────────────────────────

function useRecordingTimer(active: boolean) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) { setElapsed(0); return; }
    const iv = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [active]);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  return { elapsed, display: `${mm}:${ss}` };
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  children: React.ReactNode;
  overlayActive?: boolean;
}

export function BugReporter({ children, overlayActive = false }: Props) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [liveLogs, setLiveLogs] = useState<ReturnType<typeof getGlobalLogs>>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [audioAvailable, setAudioAvailable] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRecordingRef = useRef<Audio.Recording | null>(null);

  const { elapsed, display: timerDisplay } = useRecordingTimer(isRecording);

  // RN Animated red dot pulse (ZERO Reanimated — iron rule)
  const dotAnim = useRef(new Animated.Value(1)).current;
  const dotPulseRef = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => {
    if (!visible || !isRecording) { dotAnim.setValue(1); dotPulseRef.current?.stop(); return; }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 0.2, duration: 500, useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      { iterations: 999 }
    );
    dotPulseRef.current = pulse;
    pulse.start();
    return () => { pulse.stop(); dotPulseRef.current = null; };
  }, [visible, isRecording]);

  // Request mic permissions on mount (non-blocking)
  useEffect(() => {
    if (Platform.OS !== 'web') {
      Audio.requestPermissionsAsync().catch(() => {});
    }
  }, []);

  async function startAudio() {
    if (Platform.OS === 'web') return;
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      audioRecordingRef.current = recording;
      setAudioAvailable(true);
    } catch {
      setAudioAvailable(false);
    }
  }

  async function stopAudio(): Promise<string | null> {
    if (!audioRecordingRef.current) return null;
    try {
      await audioRecordingRef.current.stopAndUnloadAsync();
      const uri = audioRecordingRef.current.getURI() ?? null;
      audioRecordingRef.current = null;
      setAudioAvailable(false);
      return uri;
    } catch {
      audioRecordingRef.current = null;
      return null;
    }
  }

  const pathname = usePathname();
  const path = pathname ?? '';
  const isGameScreen = ['/game', '/multiplayer-game', '/sit-and-go', '/tournament', '/orientation-pick'].includes(path) || path.startsWith('/lobby');
  const fabBottom = pathname === '/' ? insets.bottom + 60 : insets.bottom + 16;

  // Dev ping on mount
  useEffect(() => {
    if (!__DEV__) return;
    submitBugReport(`[ping] app opened v${VERSION}`, '[dev ping]', 'mount', [], { classification: 'UNRELATED', summary: 'dev ping' }, false, null).catch(() => {});
  }, []);

  const openReporter = useCallback(async () => {
    Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Medium)?.catch?.(() => {});
    setNote('');
    setStatus('idle');
    setLiveLogs(getGlobalLogs());
    setVisible(true);

    // Start screen recording + audio recording in parallel
    const [started] = await Promise.all([startRecording(), startAudio()]);
    setIsRecording(started);

    // Auto-stop at 60s
    autoStopRef.current = setTimeout(() => handleStop(true), MAX_AUTO_STOP_S * 1000);
  }, []);

  // Poll debug logs every 500ms while recording
  useEffect(() => {
    if (!visible) { if (logPollRef.current) clearInterval(logPollRef.current); return; }
    logPollRef.current = setInterval(() => {
      const newLogs = getGlobalLogs();
      setLiveLogs([...newLogs]);
    }, 500);
    return () => { if (logPollRef.current) clearInterval(logPollRef.current); };
  }, [visible]);

  // Auto-scroll log list to bottom
  useEffect(() => {
    if (liveLogs.length > 0) {
      flatListRef.current?.scrollToEnd?.({ animated: false });
    }
  }, [liveLogs]);

  const handleCancel = useCallback(async () => {
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    await Promise.all([stopRecording(), stopAudio()]);
    setIsRecording(false);
    setVisible(false);
  }, []);

  const handleStop = useCallback(async (autoStopped = false) => {
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    setSending(true);
    setStatus('idle');

    try {
      // 1. Stop screen + audio recording in parallel
      const [, audioUri, frames] = await Promise.all([
        stopRecording(),
        stopAudio(),
        getLastCrashScreenshots(),
      ]);
      setIsRecording(false);

      // 2. Get current log snapshot
      const logs = getGlobalLogs();
      const hasVideo = frames.length > 0;

      // 3. Upload audio to Supabase Storage
      const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || extra?.supabaseUrl || '';
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra?.supabaseAnonKey || '';
      const audioUrl = audioUri ? await uploadAudio(audioUri, supabaseUrl, supabaseKey) : null;

      // 4. AI triage (with timeout fallback)
      let triage: TriageResult = { classification: 'PENDING', summary: 'Classifying...' };
      try {
        const triagePromise = classifyBugReport(logs, note);
        const timeout = new Promise<TriageResult>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000));
        triage = await Promise.race([triagePromise, timeout]);
      } catch { triage = { classification: 'PENDING', summary: 'Triage timeout' }; }

      // 5. Submit to Supabase
      const titleText = note.trim() || (autoStopped ? `Auto-stopped after ${MAX_AUTO_STOP_S}s` : 'Bug recorded');
      await submitBugReport(
        titleText,
        note.trim(),
        pathname || 'unknown',
        logs,
        triage,
        hasVideo,
        audioUrl,
      );

      Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType.Success)?.catch?.(() => {});
      setStatus('success');
      setTimeout(() => setVisible(false), 1500);
    } catch {
      setStatus('error');
      setSending(false);
    }
  }, [note, pathname]);

  useShakeDetection(openReporter, !visible);

  const renderLogItem = useCallback(({ item, index }: { item: ReturnType<typeof getGlobalLogs>[0]; index: number }) => (
    <Text
      key={index}
      style={[styles.logLine, item.level === 'error' && styles.logError, item.level === 'warn' && styles.logWarn]}
      numberOfLines={2}
    >
      <Text style={styles.logSeq}>[{String(index + 1).padStart(3, '0')}] </Text>
      <Text style={styles.logTime}>{item.time} </Text>
      {item.message}
    </Text>
  ), []);

  return (
    <View style={{ flex: 1 }}>
      {children}

      {/* FAB */}
      {!visible && !overlayActive && !isGameScreen && (
        <TouchableOpacity style={[styles.fab, { bottom: fabBottom }]} onPress={openReporter} activeOpacity={0.7} accessibilityLabel="Record bug">
          <Text style={styles.fabText}>🐛</Text>
        </TouchableOpacity>
      )}

      {/* Recording Modal */}
      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]}>

            {/* Header: recording indicator */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                {isRecording && (
                  <Animated.View style={[styles.recDot, { opacity: dotAnim }]} />
                )}
                <Text style={styles.headerTitle}>
                  {isRecording ? `🔴 RECORDING  ${timerDisplay}` : '🐛 Bug Reporter'}
                </Text>
              </View>
              <Text style={styles.metaText}>v{VERSION} · {pathname || '/'}</Text>
            </View>

            {/* Live debug log stream */}
            <View style={styles.logContainer}>
              <Text style={styles.logHeader}>DEBUG LOG ({liveLogs.length})</Text>
              <FlatList
                ref={flatListRef}
                data={liveLogs}
                renderItem={renderLogItem}
                keyExtractor={(_, i) => String(i)}
                style={styles.logList}
                showsVerticalScrollIndicator={false}
                getItemLayout={(_, index) => ({ length: 26, offset: 26 * index, index })}
                initialScrollIndex={Math.max(0, liveLogs.length - 1)}
                onScrollToIndexFailed={() => flatListRef.current?.scrollToEnd?.({ animated: false })}
              />
            </View>

            {/* Mic indicator */}
            <View style={styles.micRow}>
              {audioAvailable
                ? <Text style={styles.micTextActive}>🎤 Recording audio...</Text>
                : <Text style={styles.micText}>🎤 Audio unavailable — describe in text</Text>
              }
            </View>

            {/* Text note */}
            <TextInput
              style={styles.noteInput}
              placeholder="Describe the bug... (optional)"
              placeholderTextColor="#78716C"
              value={note}
              onChangeText={setNote}
              maxLength={300}
              multiline
              numberOfLines={2}
              returnKeyType="done"
              textAlignVertical="top"
            />

            {/* Status */}
            {status === 'success' && <Text style={styles.statusSuccess}>✅ Bug report sent — thank you!</Text>}
            {status === 'error' && <Text style={styles.statusError}>❌ Failed to send — try again</Text>}

            {/* Buttons */}
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} disabled={sending}>
                <Text style={styles.cancelBtnText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.stopBtn, sending && { opacity: 0.6 }]}
                onPress={() => handleStop(false)}
                disabled={sending}
                activeOpacity={0.8}
              >
                {sending
                  ? <ActivityIndicator size="small" color="#000" />
                  : <Text style={styles.stopBtnText}>⏹ STOP & SEND</Text>
                }
              </TouchableOpacity>
            </View>

            {elapsed >= 50 && (
              <Text style={styles.autoStopHint}>Auto-stops in {MAX_AUTO_STOP_S - elapsed}s</Text>
            )}

          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#c96a1a',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    shadowColor: '#c96a1a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 999,
  },
  fabText: { fontSize: 20 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0d0700',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderColor: '#3d2a1a',
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff4444',
  },
  headerTitle: { color: '#f5e6d3', fontSize: 16, fontWeight: '700' },
  metaText: { color: '#78716C', fontSize: 10 },
  logContainer: {
    backgroundColor: '#080400',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a1a0a',
    marginBottom: 10,
    height: 200,
    overflow: 'hidden',
  },
  logHeader: {
    color: '#00ff00',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1a3a1a',
  },
  logList: { flex: 1, paddingHorizontal: 6, paddingVertical: 2 },
  logLine: { color: '#00cc00', fontSize: 9, lineHeight: 13, marginBottom: 1 },
  logError: { color: '#ff4444' },
  logWarn: { color: '#ffaa00' },
  logSeq: { color: '#666', fontSize: 8 },
  logTime: { color: '#555', fontSize: 8 },
  micRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  micText: { color: '#78716C', fontSize: 12, fontWeight: '600' },
  micTextActive: { color: '#4CAF50', fontSize: 12, fontWeight: '700' },
  noteInput: {
    backgroundColor: '#1a0e06',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3d2a1a',
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#f5e6d3',
    fontSize: 14,
    marginBottom: 12,
    minHeight: 60,
  },
  statusSuccess: { color: '#4CAF50', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  statusError: { color: '#ff4444', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  btnRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3d2a1a',
    alignItems: 'center',
  },
  cancelBtnText: { color: '#78716C', fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  stopBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#ff4444',
    alignItems: 'center',
  },
  stopBtnText: { color: '#000', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  autoStopHint: { color: '#ff6666', fontSize: 11, textAlign: 'center', marginTop: 6 },
});
