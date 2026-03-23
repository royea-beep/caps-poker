/**
 * CrashBoundary — React class component error boundary.
 * On crash: captures screenshot evidence, uploads to Supabase, sends WhatsApp.
 * Shows crash screen with "Copy Fix Prompt" button for Claude Bot.
 */
import React from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { Clipboard } from 'react-native'
import { generateCrashReport, CrashReport } from '../utils/crash-evidence'
import { sendCrashToWhatsApp } from '../utils/debug-whatsapp'
import { debugLog } from './DebugOverlay'

interface State {
  hasError: boolean
  report: CrashReport | null
  sending: boolean
  copied: boolean
}

export class CrashBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, report: null, sending: false, copied: false }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true }
  }

  async componentDidCatch(error: Error, info: React.ErrorInfo) {
    debugLog(`[CrashBoundary] caught: ${error.message}`, 'error')

    const report = await generateCrashReport({
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack ?? undefined,
    })

    this.setState({ report })

    try {
      this.setState({ sending: true })
      await sendCrashToWhatsApp(report)
    } catch (e) {
      debugLog(`[CrashBoundary] WhatsApp send failed: ${e}`, 'warn')
    } finally {
      this.setState({ sending: false })
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const { report, sending, copied } = this.state

    return (
      <View style={s.container}>
        <Text style={s.title}>💥 Crash Detected</Text>
        <Text style={s.error}>{report?.error?.message ?? 'Unknown error'}</Text>

        <View style={s.meta}>
          <Text style={s.metaText}>Screen: {report?.lastScreen ?? '?'}</Text>
          <Text style={s.metaText}>Action: {report?.lastAction ?? '?'}</Text>
          <Text style={s.metaText}>
            {report?.frames?.length ?? 0} frames captured · {report?.stepLog?.length ?? 0} steps logged
          </Text>
        </View>

        <Text style={[s.status, sending ? s.statusSending : s.statusDone]}>
          {sending
            ? '📤 Sending crash report to WhatsApp...'
            : (report?.storageUrls?.length ?? 0) > 0
              ? `✅ ${report!.storageUrls.length} screenshots uploaded + WhatsApp sent`
              : '⏳ Collecting evidence...'}
        </Text>

        {(report?.storageUrls?.length ?? 0) > 0 && (
          <ScrollView style={s.urls}>
            {report!.storageUrls.map((url, i) => (
              <Text key={i} style={s.urlText}>📸 Frame {i + 1}: {url.slice(-40)}</Text>
            ))}
          </ScrollView>
        )}

        {report?.fixPrompt && (
          <>
            <TouchableOpacity
              style={[s.btn, s.btnBlue]}
              onPress={() => {
                Clipboard.setString(report.fixPrompt)
                this.setState({ copied: true })
                setTimeout(() => this.setState({ copied: false }), 3000)
              }}
            >
              <Text style={s.btnText}>
                {copied ? '✅ הועתק! Paste to Claude Bot' : '📋 Copy Fix Prompt for Claude Bot'}
              </Text>
            </TouchableOpacity>
            <ScrollView style={s.promptPreview}>
              <Text style={s.promptText}>
                {report.fixPrompt.slice(0, 600)}
                {report.fixPrompt.length > 600 ? '\n...(full version copied)' : ''}
              </Text>
            </ScrollView>
          </>
        )}
        {!report?.fixPrompt && (
          <Text style={[s.metaText, { marginTop: 12, color: '#ff8800' }]}>
            ⚠️ NO FIX PROMPT — generateCrashReport failed
          </Text>
        )}

        <TouchableOpacity
          style={[s.btn, s.btnGray]}
          onPress={() => this.setState({ hasError: false, report: null, copied: false })}
        >
          <Text style={s.btnText}>🔄 Try Again</Text>
        </TouchableOpacity>
      </View>
    )
  }
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a0000',
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    color: '#ff4444',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  error: {
    color: '#ff8888',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  meta: {
    marginTop: 12,
    alignItems: 'center',
    gap: 2,
  },
  metaText: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
  },
  status: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
  statusSending: { color: '#ffaa00' },
  statusDone: { color: '#44ff44' },
  urls: {
    marginTop: 8,
    maxHeight: 80,
  },
  urlText: {
    color: '#4488ff',
    fontSize: 10,
    marginTop: 2,
  },
  btn: {
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  btnBlue: { backgroundColor: '#2563eb' },
  btnGray: { backgroundColor: '#333' },
  btnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 15,
  },
  promptPreview: {
    marginTop: 8,
    maxHeight: 180,
    backgroundColor: '#111',
    borderRadius: 6,
    padding: 8,
  },
  promptText: {
    color: '#9ca3af',
    fontSize: 9,
    fontFamily: 'monospace',
  },
})
