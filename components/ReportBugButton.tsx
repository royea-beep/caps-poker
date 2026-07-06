/**
 * ReportBugButton — a simple, DISCOVERABLE "Report a bug" entry for testers.
 *
 * The full BugReporter pipeline (screenshot/video/audio → AI triage → Telegram/GitHub) already
 * exists, but its only triggers are a __DEV__-gated 🐛 FAB and a native-only shake gesture — so
 * testers on web/prod builds have no reachable entry. This is the reachable one: a lightweight
 * text form (description + tester name + current screen) that INSERTs into bug_reports. The
 * AFTER-INSERT trigger `on_bug_report_inserted` → `trigger_analyze_bug_report()` runs the same
 * downstream pipeline (AI severity, Telegram, GitHub issue), so a plain insert is enough.
 *
 * Two variants, same modal:
 *   - variant="fab": a small floating 🐛 affordance (mount on main screens).
 *   - variant="row": a Settings-style row.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Modal, Platform, ActivityIndicator, KeyboardAvoidingView } from 'react-native';
import { usePathname } from 'expo-router';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { getSupabase } from '../utils/supabase';
import { useGameStore } from '../store/gameStore';
import { rf, rs } from '../utils/responsive';

const PROJECT = 'caps-poker';
const APP_VERSION = Constants.expoConfig?.version ?? '2.7.0';

interface Props {
  variant?: 'fab' | 'row';
}

export default function ReportBugButton({ variant = 'fab' }: Props) {
  const pathname = usePathname();
  const playerName = useGameStore((s) => s.playerName);

  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [name, setName] = useState(playerName || '');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  const reset = useCallback(() => {
    setDescription('');
    setStatus('idle');
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    reset();
  }, [reset]);

  const send = useCallback(async () => {
    const desc = description.trim();
    if (!desc || status === 'sending') return;
    setStatus('sending');
    try {
      const sb = getSupabase();
      if (!sb) { setStatus('error'); return; }
      const tester = name.trim() || 'Anonymous';
      const firstLine = desc.split('\n')[0].slice(0, 80);
      const { error } = await sb.from('bug_reports').insert({
        project: PROJECT,
        title: `[Tester] ${tester}: ${firstLine}`,
        description: desc,
        url: pathname || 'unknown',
        tester_name: tester,
        report_type: 'text',
        app_version: APP_VERSION,
        status: 'open',
        device_info: {
          platform: Platform.OS,
          osVersion: String(Platform.Version ?? ''),
          appVersion: APP_VERSION,
          otaUpdateId: Updates.updateId ?? 'embedded',
          source: 'tester_report_button',
        },
      });
      if (error) { setStatus('error'); return; }
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }, [description, name, pathname, status]);

  return (
    <>
      {variant === 'fab' ? (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setOpen(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Report a bug"
          testID="report-bug-fab"
        >
          <Text style={styles.fabText}>🐛</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.row}
          onPress={() => setOpen(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Report a bug"
          testID="report-bug-row"
        >
          <Text style={styles.rowIcon}>🐛</Text>
          <Text style={styles.rowLabel}>Report a bug</Text>
          <Text style={styles.rowChevron}>›</Text>
        </TouchableOpacity>
      )}

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.backdrop}
        >
          <View style={styles.sheet}>
            {status === 'done' ? (
              <View style={styles.doneWrap}>
                <Text style={styles.doneTitle}>✅ Thanks!</Text>
                <Text style={styles.doneBody}>Your report was sent to the team.</Text>
                <TouchableOpacity style={styles.sendBtn} onPress={close} accessibilityRole="button" accessibilityLabel="Close">
                  <Text style={styles.sendText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.title}>🐛 Report a bug</Text>
                <Text style={styles.hint}>What went wrong? The more detail, the faster we fix it.</Text>

                <TextInput
                  style={styles.input}
                  placeholder="Your name (so we can follow up)"
                  placeholderTextColor="#8A8A8A"
                  value={name}
                  onChangeText={setName}
                  maxLength={40}
                  accessibilityLabel="Your name"
                />
                <TextInput
                  style={[styles.input, styles.textarea]}
                  placeholder="Describe the bug — what you did, what you expected, what happened…"
                  placeholderTextColor="#8A8A8A"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={5}
                  maxLength={1000}
                  textAlignVertical="top"
                  accessibilityLabel="Bug description"
                  testID="report-bug-description"
                />
                <Text style={styles.screenNote}>Screen: {pathname || 'unknown'}</Text>
                {status === 'error' && <Text style={styles.errorText}>Couldn't send — check your connection and try again.</Text>}

                <View style={styles.actions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={close} accessibilityRole="button" accessibilityLabel="Cancel">
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sendBtn, (!description.trim() || status === 'sending') && styles.sendBtnDisabled]}
                    onPress={send}
                    disabled={!description.trim() || status === 'sending'}
                    accessibilityRole="button"
                    accessibilityLabel="Send report"
                    testID="report-bug-send"
                  >
                    {status === 'sending' ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendText}>Send</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    // POLISH-1 (3c) — sat right on the Home legal-disclaimer line ("Free play · … · 17+").
    // RESPONSIVE-FIX 2026-07-06 — empirically re-measured (real getBoundingClientRect
    // comparisons against the deployed build, not hand-computed estimates): the earlier
    // 52->70 bump moved in the WRONG direction. "bottom" is distance from the container's
    // BOTTOM edge, so a LARGER value pushes the FAB UP/closer to the disclaimer above it,
    // not further away. Verified overlap at rs(70) on real iPhone dimensions (375x812,
    // 380x844, 390x844, 393x852 — iPhone 12 mini/14/15, a huge share of the iOS install
    // base). rs(20) clears all of them (9-168px margin) plus 320x568 and 480x960, and Home
    // is now wrapped in a ScrollView (see app/(tabs)/index.tsx) so this is no longer the
    // only thing standing between the disclaimer and being genuinely unreachable.
    position: 'absolute', right: rs(14), bottom: rs(20),
    width: rs(44), height: rs(44), borderRadius: rs(22),
    backgroundColor: 'rgba(201,106,26,0.92)', alignItems: 'center', justifyContent: 'center',
    zIndex: 9000, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: rs(6), shadowOffset: { width: 0, height: rs(2) }, elevation: 6,
  },
  fabText: { fontSize: rf(20) },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: rs(14), paddingHorizontal: rs(16),
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: rs(12), gap: rs(12),
  },
  rowIcon: { fontSize: rf(18) },
  rowLabel: { flex: 1, color: '#EDE6D6', fontSize: rf(16), fontWeight: '600' },
  rowChevron: { color: '#8A8A8A', fontSize: rf(22) },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1B1410', borderTopLeftRadius: rs(20), borderTopRightRadius: rs(20), padding: rs(20), paddingBottom: rs(32), gap: rs(10) },
  title: { color: '#F5B546', fontSize: rf(20), fontWeight: '800' },
  hint: { color: '#B7ADA0', fontSize: rf(13), marginBottom: rs(4) },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: rs(10), paddingHorizontal: rs(14), paddingVertical: rs(12),
    color: '#F3ECDD', fontSize: rf(15), borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  textarea: { minHeight: rs(110) },
  screenNote: { color: '#7C736A', fontSize: rf(12) },
  errorText: { color: '#FF6B6B', fontSize: rf(13) },
  actions: { flexDirection: 'row', gap: rs(12), marginTop: rs(8) },
  cancelBtn: { flex: 1, paddingVertical: rs(14), borderRadius: rs(12), alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  cancelText: { color: '#C9BFB2', fontSize: rf(16), fontWeight: '700' },
  sendBtn: { flex: 1, paddingVertical: rs(14), borderRadius: rs(12), alignItems: 'center', backgroundColor: '#1E7D46' },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { color: '#fff', fontSize: rf(16), fontWeight: '800' },
  doneWrap: { alignItems: 'center', gap: rs(10), paddingVertical: rs(16) },
  doneTitle: { color: '#4ADE80', fontSize: rf(22), fontWeight: '800' },
  doneBody: { color: '#B7ADA0', fontSize: rf(14), textAlign: 'center' },
});
