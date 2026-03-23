/**
 * Auto-Debug Screen — runs numbered logic steps, shows results, sends WhatsApp alert on failure.
 * Accessible from Settings (dev builds only).
 */
import React, { useState, useCallback, useRef } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Platform, Clipboard,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AutoDebugRunner, DebugReport, StepResult } from '../utils/auto-debug'
import { CAPS_DEBUG_STEPS } from '../utils/debug-suite'
import { sendDebugReportToWhatsApp } from '../utils/debug-whatsapp'
import { COLORS } from '../constants/gameConfig'
import Constants from 'expo-constants'
import * as Application from 'expo-application'

function getBuildInfo() {
  const version = Constants.expoConfig?.version ?? '?'
  const build = (Platform.OS !== 'web' ? Application.nativeBuildVersion : null)
    ?? Constants.expoConfig?.ios?.buildNumber
    ?? '?'
  return { version, build }
}

type RunStatus = 'idle' | 'running' | 'done'

export default function DebugScreen() {
  const router = useRouter()
  const [status, setStatus] = useState<RunStatus>('idle')
  const [stepResults, setStepResults] = useState<StepResult[]>([])
  const [report, setReport] = useState<DebugReport | null>(null)
  const [whatsappSent, setWhatsappSent] = useState(false)
  const [copied, setCopied] = useState(false)
  const runnerRef = useRef<AutoDebugRunner | null>(null)

  const runDebug = useCallback(async () => {
    setStatus('running')
    setStepResults([])
    setReport(null)
    setWhatsappSent(false)
    setCopied(false)

    const { version, build } = getBuildInfo()
    const runner = new AutoDebugRunner('Caps', version, build, CAPS_DEBUG_STEPS)
    runnerRef.current = runner

    const finalReport = await runner.run((result) => {
      setStepResults(prev => [...prev, result])
    })

    setReport(finalReport)
    setStatus('done')

    if (finalReport.failedAt) {
      await sendDebugReportToWhatsApp(finalReport)
      setWhatsappSent(true)
    }
  }, [])

  const copyPrompt = useCallback(() => {
    if (!report?.autoFixPrompt) return
    Clipboard.setString(report.autoFixPrompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [report])

  const statusColor = (s: StepResult['status']) => {
    switch (s) {
      case 'pass':    return '#00cc66'
      case 'fail':    return '#ffaa00'
      case 'crash':   return '#ff4444'
      case 'timeout': return '#ff8800'
    }
  }

  const statusIcon = (s: StepResult['status']) => {
    switch (s) {
      case 'pass':    return '✅'
      case 'fail':    return '⚠️'
      case 'crash':   return '💀'
      case 'timeout': return '⏱️'
    }
  }

  const { version, build } = getBuildInfo()

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>AUTO-DEBUG</Text>
        <Text style={styles.buildInfo}>v{version} ({build})</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Summary banner */}
        {report && (
          <View style={[styles.summaryCard, { borderColor: report.failedAt ? '#ff4444' : '#00cc66' }]}>
            <Text style={[styles.summaryTitle, { color: report.failedAt ? '#ff4444' : '#00cc66' }]}>
              {report.failedAt
                ? `❌ FAILED at Step ${report.failedAt}/${report.totalSteps}`
                : `✅ ALL ${report.totalSteps} STEPS PASSED`}
            </Text>
            <Text style={styles.summaryDetail}>
              {report.passed}/{report.totalSteps} passed
              {report.failedAt ? ` · crashed: "${report.failedStep}"` : ''}
            </Text>
            {whatsappSent && (
              <Text style={styles.waSent}>📱 WhatsApp alert sent</Text>
            )}
          </View>
        )}

        {/* Steps list */}
        {CAPS_DEBUG_STEPS.map(step => {
          const result = stepResults.find(r => r.stepId === step.id)
          const isRunning = status === 'running' && !result && stepResults.length === step.id - 1

          return (
            <View key={step.id} style={styles.stepRow}>
              <View style={styles.stepLeft}>
                <Text style={styles.stepNum}>{step.id}</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepName}>{step.name}</Text>
                {result && (
                  <View style={styles.stepMeta}>
                    <Text style={[styles.stepStatus, { color: statusColor(result.status) }]}>
                      {statusIcon(result.status)} {result.status.toUpperCase()} — {result.duration}ms
                    </Text>
                    {result.error && (
                      <Text style={styles.stepError} numberOfLines={2}>{result.error}</Text>
                    )}
                  </View>
                )}
                {isRunning && (
                  <Text style={styles.stepRunning}>⟳ running...</Text>
                )}
              </View>
            </View>
          )
        })}

        {/* Fix prompt copy */}
        {report?.autoFixPrompt && (
          <TouchableOpacity style={styles.copyBtn} onPress={copyPrompt}>
            <Text style={styles.copyBtnText}>
              {copied ? '✅ Copied!' : '📋 Copy Fix Prompt'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Run button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.runBtn, status === 'running' && styles.runBtnDisabled]}
          onPress={runDebug}
          disabled={status === 'running'}
        >
          <Text style={styles.runBtnText}>
            {status === 'running' ? '⟳ Running...' : status === 'done' ? '▶ Run Again' : '▶ Run Debug'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  back: {
    color: COLORS.gold,
    fontSize: 15,
    fontWeight: '600',
  },
  title: {
    color: COLORS.goldBright,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 3,
  },
  buildInfo: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 8,
    paddingBottom: 24,
  },
  summaryCard: {
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  summaryDetail: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
  },
  waSent: {
    color: '#25d366',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  stepRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 10,
    gap: 10,
  },
  stepLeft: {
    width: 24,
    alignItems: 'center',
    paddingTop: 1,
  },
  stepNum: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
  },
  stepName: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  stepMeta: {
    marginTop: 4,
    gap: 2,
  },
  stepStatus: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  stepError: {
    color: '#ff8888',
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  stepRunning: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  copyBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  copyBtnText: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  runBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  runBtnDisabled: {
    opacity: 0.4,
  },
  runBtnText: {
    color: COLORS.background,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2,
  },
})
