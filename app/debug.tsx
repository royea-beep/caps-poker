/**
 * Auto-Debug Screen — runs numbered logic steps, shows results, sends WhatsApp alert on failure.
 * Accessible from Settings (dev builds only).
 */
import React, { useState, useCallback, useRef } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Platform, Clipboard,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AutoDebugRunner, DebugReport, StepResult } from '../utils/auto-debug'
import { CAPS_DEBUG_STEPS } from '../utils/debug-suite'
import { sendDebugReportToWhatsApp } from '../utils/debug-whatsapp'
import { runSimulation, SimulationReport } from '../utils/debug-simulation'
import { COLORS } from '../constants/gameConfig'
import Constants from 'expo-constants'
import * as Application from 'expo-application'
import { safeBack } from '../components/BackControl';

// ─── QA Checks ───────────────────────────────────────────────────────────────
interface QACheck {
  name: string
  test: () => Promise<boolean>
  expected: string
  timeout?: number
}

interface QAResult {
  name: string
  expected: string
  passed: boolean
  duration: number
  error?: string
}

const CAPS_QA_CHECKS: QACheck[] = [
  {
    name: 'Supabase URL configured',
    test: async () => {
      const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
      return url.length > 0
    },
    expected: 'EXPO_PUBLIC_SUPABASE_URL set',
  },
  {
    name: 'App version readable',
    test: async () => {
      return !!Constants.expoConfig?.version
    },
    expected: 'Version in app.json',
  },
  {
    name: 'VersionBadge component exists',
    test: async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('../components/VersionBadge')
      return typeof mod.VersionBadge === 'function'
    },
    expected: 'VersionBadge component importable',
  },
  {
    name: 'WhatsApp bot URL reachable (HEAD)',
    test: async () => {
      try {
        const r = await fetch(
          'https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/telegram-bot-handler',
          { method: 'HEAD' },
        )
        return r.status < 500
      } catch {
        return false
      }
    },
    expected: 'WhatsApp Edge Function not 5xx',
    timeout: 8000,
  },
]

async function runQAWithTimeout(fn: () => Promise<boolean>, ms: number): Promise<boolean> {
  return Promise.race([
    fn(),
    new Promise<boolean>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms),
    ),
  ])
}

// ─────────────────────────────────────────────────────────────────────────────

function getBuildInfo() {
  const version = Constants.expoConfig?.version ?? '?'
  const build = (Platform.OS !== 'web' ? Application.nativeBuildVersion : null)
    ?? Constants.expoConfig?.ios?.buildNumber
    ?? '?'
  return { version, build }
}

type RunStatus = 'idle' | 'running' | 'done'
type QAStatus = 'idle' | 'running' | 'done'

export default function DebugScreen() {
  const [status, setStatus] = useState<RunStatus>('idle')
  const [stepResults, setStepResults] = useState<StepResult[]>([])
  const [report, setReport] = useState<DebugReport | null>(null)
  const [whatsappSent, setWhatsappSent] = useState(false)
  const [copied, setCopied] = useState(false)
  const runnerRef = useRef<AutoDebugRunner | null>(null)

  // QA state
  const [qaStatus, setQaStatus] = useState<QAStatus>('idle')
  const [qaResults, setQaResults] = useState<QAResult[]>([])
  const [qaAlertSent, setQaAlertSent] = useState(false)
  const [simRunning, setSimRunning] = useState(false)
  const [simReport, setSimReport] = useState<SimulationReport | null>(null)

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

  const runSim = useCallback(async () => {
    setSimRunning(true)
    setSimReport(null)
    try {
      const report = await runSimulation()
      setSimReport(report)
    } catch (e) {
      console.error('[Simulation] failed:', e)
    } finally {
      setSimRunning(false)
    }
  }, [])

  const runQA = useCallback(async () => {
    setQaStatus('running')
    setQaResults([])
    setQaAlertSent(false)

    const results: QAResult[] = []

    for (const check of CAPS_QA_CHECKS) {
      const start = Date.now()
      let passed = false
      let error: string | undefined

      try {
        passed = await runQAWithTimeout(check.test, check.timeout ?? 5000)
      } catch (e) {
        passed = false
        error = e instanceof Error ? e.message : String(e)
      }

      const result: QAResult = {
        name: check.name,
        expected: check.expected,
        passed,
        duration: Date.now() - start,
        error,
      }

      results.push(result)
      setQaResults([...results])
    }

    setQaStatus('done')

    const anyFailed = results.some(r => !r.passed)
    if (anyFailed) {
      const { version, build } = getBuildInfo()
      const failedNames = results.filter(r => !r.passed).map(r => r.name).join(', ')
      const fakeReport: DebugReport = {
        project: 'Caps',
        version,
        build,
        totalSteps: results.length,
        passed: results.filter(r => r.passed).length,
        failedAt: results.findIndex(r => !r.passed) + 1,
        failedStep: failedNames,
        results: [],
        autoFixPrompt: `QA FAILURES in Caps v${version}:\n${results
          .filter(r => !r.passed)
          .map(r => `- ${r.name}: expected "${r.expected}"${r.error ? ` (${r.error})` : ''}`)
          .join('\n')}`,
        timestamp: new Date().toISOString(),
      }
      await sendDebugReportToWhatsApp(fakeReport)
      setQaAlertSent(true)
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
      case 'pass':    return '\u2705'
      case 'fail':    return '\u26a0\ufe0f'
      case 'crash':   return '\ud83d\udc80'
      case 'timeout': return '\u23f1\ufe0f'
    }
  }

  const { version, build } = getBuildInfo()

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={safeBack} hitSlop={12}>
          <Text style={styles.back}>{'\u2190'} Back</Text>
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
                ? `\u274c FAILED at Step ${report.failedAt}/${report.totalSteps}`
                : `\u2705 ALL ${report.totalSteps} STEPS PASSED`}
            </Text>
            <Text style={styles.summaryDetail}>
              {report.passed}/{report.totalSteps} passed
              {report.failedAt ? ` \u00b7 crashed: "${report.failedStep}"` : ''}
            </Text>
            {whatsappSent && (
              <Text style={styles.waSent}>{'\ud83d\udcf1'} WhatsApp alert sent</Text>
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
                      {statusIcon(result.status)} {result.status.toUpperCase()} \u2014 {result.duration}ms
                    </Text>
                    {result.error && (
                      <Text style={styles.stepError} numberOfLines={2}>{result.error}</Text>
                    )}
                  </View>
                )}
                {isRunning && (
                  <Text style={styles.stepRunning}>{'\u27f3'} running...</Text>
                )}
              </View>
            </View>
          )
        })}

        {/* Fix prompt copy */}
        {report?.autoFixPrompt && (
          <TouchableOpacity style={styles.copyBtn} onPress={copyPrompt}>
            <Text style={styles.copyBtnText}>
              {copied ? '\u2705 Copied!' : '\ud83d\udccb Copy Fix Prompt'}
            </Text>
          </TouchableOpacity>
        )}

        {/* QA Section divider */}
        <View style={styles.qaSectionHeader}>
          <Text style={styles.qaSectionTitle}>{'\ud83d\udd0d'} LOGIC QA</Text>
          <Text style={styles.qaSectionSub}>{CAPS_QA_CHECKS.length} checks \u00b7 iron rules compliance</Text>
        </View>

        {/* QA summary (shown after run) */}
        {qaStatus === 'done' && qaResults.length > 0 && (
          <View style={[
            styles.summaryCard,
            { borderColor: qaResults.every(r => r.passed) ? '#00cc66' : '#ff4444' },
          ]}>
            <Text style={[
              styles.summaryTitle,
              { color: qaResults.every(r => r.passed) ? '#00cc66' : '#ff4444' },
            ]}>
              {qaResults.every(r => r.passed)
                ? `\u2705 ALL ${qaResults.length} QA CHECKS PASSED`
                : `\u274c ${qaResults.filter(r => !r.passed).length}/${qaResults.length} CHECKS FAILED`}
            </Text>
            <Text style={styles.summaryDetail}>
              {qaResults.filter(r => r.passed).length}/{qaResults.length} passed
            </Text>
            {qaAlertSent && (
              <Text style={styles.waSent}>{'\ud83d\udcf1'} WhatsApp QA alert sent</Text>
            )}
          </View>
        )}

        {/* QA idle rows */}
        {qaStatus === 'idle' && CAPS_QA_CHECKS.map((check, i) => (
          <View key={`qa-idle-${i}`} style={styles.stepRow}>
            <View style={styles.stepLeft}>
              <Text style={styles.stepNum}>{i + 1}</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepName}>{check.name}</Text>
              <Text style={styles.qaPending}>expects: {check.expected}</Text>
            </View>
          </View>
        ))}

        {/* QA running/done rows */}
        {(qaStatus === 'running' || qaStatus === 'done') && CAPS_QA_CHECKS.map((check, i) => {
          const result = qaResults[i]
          const isRunningNow = !result && i === qaResults.length
          return (
            <View key={`qa-run-${i}`} style={styles.stepRow}>
              <View style={styles.stepLeft}>
                <Text style={[styles.stepNum, result
                  ? { color: result.passed ? '#00cc66' : '#ff4444' }
                  : {},
                ]}>
                  {result ? (result.passed ? '\u2713' : '\u2717') : String(i + 1)}
                </Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepName}>{check.name}</Text>
                {result && (
                  <View style={styles.stepMeta}>
                    <Text style={[styles.stepStatus, { color: result.passed ? '#00cc66' : '#ff4444' }]}>
                      {result.passed ? '\u2705 PASS' : '\u274c FAIL'} \u2014 {result.duration}ms
                    </Text>
                    {!result.passed && (
                      <Text style={styles.stepError} numberOfLines={3}>
                        expected: {result.expected}{result.error ? `\n${result.error}` : ''}
                      </Text>
                    )}
                  </View>
                )}
                {isRunningNow && <Text style={styles.stepRunning}>{'\u27f3'} running...</Text>}
              </View>
            </View>
          )
        })}
      </ScrollView>

      {/* Footer — two buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.runBtn, status === 'running' && styles.runBtnDisabled]}
          onPress={runDebug}
          disabled={status === 'running'}
        >
          <Text style={styles.runBtnText}>
            {status === 'running' ? '\u27f3 Running...' : status === 'done' ? '\u25b6 Run Again' : '\u25b6 Run Debug'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.qaBtn, qaStatus === 'running' && styles.runBtnDisabled]}
          onPress={runQA}
          disabled={qaStatus === 'running'}
        >
          <Text style={styles.qaBtnText}>
            {qaStatus === 'running' ? '\u27f3 Running QA...' : qaStatus === 'done' ? '\ud83d\udd0d Run QA Again' : '\ud83d\udd0d Run QA'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.crashBtn}
          onPress={() => { throw new Error('TEST CRASH — verify evidence system') }}
        >
          <Text style={styles.crashBtnText}>💥 Trigger Test Crash</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.simBtn, simRunning && styles.runBtnDisabled]}
          onPress={runSim}
          disabled={simRunning}
        >
          <Text style={styles.simBtnText}>
            {simRunning ? '⏳ Running simulation...' : '🎮 Simulate 10 Players (2 crash)'}
          </Text>
        </TouchableOpacity>
      </View>

      {simReport && (
        <View style={styles.simResults}>
          <Text style={styles.simTitle}>📊 Simulation Results</Text>
          <Text style={styles.simClean}>✅ Clean: {simReport.completedClean}/{simReport.totalPlayers}</Text>
          <Text style={styles.simCrashed}>💥 Crashed: {simReport.crashed}/{simReport.totalPlayers}</Text>
          {simReport.crashReports.map((cr, i) => (
            <View key={i} style={styles.crashCard}>
              <Text style={styles.crashCardTitle}>💥 P{cr.playerId}: {cr.playerName}</Text>
              <Text style={styles.crashCardErr}>Error: {cr.error.slice(0, 80)}</Text>
              <Text style={styles.crashCardMeta}>
                📸 {cr.screenshotsUploaded} shots · 📱 WA {cr.whatsappSent ? '✅' : '❌'} · 💾 DB {cr.dbSaved ? '✅' : '❌'} · 📋 {cr.fixPromptLength}c
              </Text>
            </View>
          ))}
          <Text style={styles.simLog}>{simReport.debugLines.join('\n')}</Text>
        </View>
      )}
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
  qaSectionHeader: {
    marginTop: 16,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  qaSectionTitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
  },
  qaSectionSub: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  qaPending: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
    fontStyle: 'italic',
  },
  footer: {
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 10,
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
  qaBtn: {
    backgroundColor: 'rgba(99,102,241,0.85)',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  qaBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2,
  },
  crashBtn: {
    backgroundColor: 'rgba(220,38,38,0.85)',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 2,
  },
  crashBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  simBtn: {
    backgroundColor: '#7c3aed',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  simBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  simResults: {
    margin: 12,
    padding: 12,
    backgroundColor: '#0f0f23',
    borderRadius: 10,
  },
  simTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 6,
  },
  simClean: { color: '#4ade80', fontSize: 13 },
  simCrashed: { color: '#f87171', fontSize: 13, marginBottom: 6 },
  crashCard: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#1a0000',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  crashCardTitle: { color: '#ff6666', fontWeight: 'bold', fontSize: 13 },
  crashCardErr: { color: '#ffaaaa', fontSize: 11, marginTop: 2 },
  crashCardMeta: { color: '#aaa', fontSize: 11, marginTop: 4 },
  simLog: {
    color: '#666',
    fontSize: 9,
    fontFamily: 'monospace',
    marginTop: 10,
  },
})
