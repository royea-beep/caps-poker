/**
 * BugReporter for CAPS Poker
 * Shake phone → modal → describe bug → send to Supabase bug_reports.
 * FAB hidden when game overlays are showing (pointerEvents: 'none').
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { usePathname } from 'expo-router';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';

const PROJECT = 'caps-poker';
const VERSION = '1.3.3';

// ── Shake Detection ──

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
            if (now - lastShake.current > 2000) {
              lastShake.current = now;
              onShake();
            }
          }
        });
      } catch {
        // expo-sensors not available — shake detection disabled
      }
    })();

    return () => { sub?.remove(); };
  }, [enabled, onShake]);
}

// ── Supabase Insert ──

async function submitBugReport(
  title: string,
  description: string,
  screen: string,
): Promise<void> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn('[BugReporter] Supabase not configured');
    return;
  }

  const row = {
    project: PROJECT,
    version: VERSION,
    title,
    description: description || null,
    url: screen,
    user_agent: `${Platform.OS} ${Platform.Version}`,
    session_id: `caps-${Date.now().toString(36)}`,
    metadata: {
      device: Constants.deviceName || 'unknown',
      platform: Platform.OS,
      expoVersion: Constants.expoConfig?.sdkVersion || 'unknown',
    },
    status: 'open',
  };

  const res = await fetch(`${url}/rest/v1/bug_reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });

  if (!res.ok) throw new Error(`${res.status}`);
}

// ── Component ──

interface Props {
  children: React.ReactNode;
  /** Hide the FAB when game overlays are active */
  overlayActive?: boolean;
}

export function BugReporter({ children, overlayActive = false }: Props) {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const pathname = usePathname();

  const openReporter = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setVisible(true);
    setTitle('');
    setDescription('');
    setStatus('idle');
  }, []);

  // Shake detection — only on native
  useShakeDetection(openReporter, !visible);

  const handleSend = useCallback(async () => {
    if (!title.trim()) {
      setStatus('error');
      return;
    }

    setSending(true);
    setStatus('idle');

    try {
      await submitBugReport(title.trim(), description.trim(), pathname || 'unknown');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setStatus('success');
      setTimeout(() => {
        setVisible(false);
      }, 1200);
    } catch {
      setStatus('error');
    } finally {
      setSending(false);
    }
  }, [title, description, pathname]);

  return (
    <View style={{ flex: 1 }}>
      {children}

      {/* FAB — hidden when overlay active or modal open */}
      {!visible && !overlayActive && (
        <TouchableOpacity
          style={styles.fab}
          onPress={openReporter}
          activeOpacity={0.7}
          accessibilityLabel="Report a bug"
        >
          <Text style={styles.fabText}>🐛</Text>
        </TouchableOpacity>
      )}

      {/* Report Modal */}
      <Modal visible={visible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => { Keyboard.dismiss(); setVisible(false); }}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => Keyboard.dismiss()}>
              <View style={styles.modalContent}>
                {/* Header */}
                <View style={styles.header}>
                  <Text style={styles.headerTitle}>🐛 Bug Report</Text>
                  <TouchableOpacity onPress={() => setVisible(false)} style={styles.closeBtn}>
                    <Text style={styles.closeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Meta info */}
                <Text style={styles.meta}>
                  {PROJECT} v{VERSION} · {pathname || '/'}
                </Text>

                {/* Title */}
                <TextInput
                  style={styles.input}
                  placeholder="What went wrong?"
                  placeholderTextColor="#78716C"
                  value={title}
                  onChangeText={(t) => { setTitle(t); setStatus('idle'); }}
                  maxLength={100}
                  autoFocus
                  returnKeyType="next"
                />

                {/* Description */}
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Steps to reproduce (optional)"
                  placeholderTextColor="#78716C"
                  value={description}
                  onChangeText={setDescription}
                  maxLength={500}
                  multiline
                  numberOfLines={3}
                  returnKeyType="done"
                  textAlignVertical="top"
                />

                {/* Status message */}
                {status === 'success' && (
                  <Text style={styles.statusSuccess}>✅ Report sent — thank you!</Text>
                )}
                {status === 'error' && !title.trim() && (
                  <Text style={styles.statusError}>Please enter a title</Text>
                )}
                {status === 'error' && title.trim() && (
                  <Text style={styles.statusError}>❌ Failed to send — try again</Text>
                )}

                {/* Send button */}
                <TouchableOpacity
                  style={[styles.sendBtn, sending && { opacity: 0.6 }]}
                  onPress={handleSend}
                  disabled={sending}
                  activeOpacity={0.7}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.sendBtnText}>📤 Send Report</Text>
                  )}
                </TouchableOpacity>

                <Text style={styles.hint}>Shake your phone to open this anytime</Text>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 110 : 80,
    left: 16,
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a0e06',
    borderRadius: 16,
    padding: 24,
    width: 340,
    maxWidth: '90%',
    borderWidth: 1,
    borderColor: '#3d2a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f5e6d3',
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 20,
    color: '#78716C',
    fontWeight: '600',
  },
  meta: {
    fontSize: 11,
    color: '#78716C',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#0d0600',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3d2a1a',
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#f5e6d3',
    fontSize: 14,
    marginBottom: 10,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  statusSuccess: {
    textAlign: 'center',
    color: '#4ecdc4',
    fontSize: 13,
    marginBottom: 8,
  },
  statusError: {
    textAlign: 'center',
    color: '#FF3B30',
    fontSize: 13,
    marginBottom: 8,
  },
  sendBtn: {
    backgroundColor: '#c96a1a',
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  hint: {
    textAlign: 'center',
    color: '#78716C',
    fontSize: 11,
    marginTop: 10,
  },
});
