/**
 * AutoDebugRunner — numbered sequential step executor.
 * Each step is a JS function (not E2E UI automation).
 * Captures console errors, detects crashes/timeouts, generates fix prompts.
 */

export interface DebugStep {
  id: number
  name: string
  action: () => Promise<void> | void
  timeout?: number  // ms, default 5000
}

export interface StepResult {
  stepId: number
  stepName: string
  status: 'pass' | 'fail' | 'crash' | 'timeout'
  duration: number
  error?: string
  stackTrace?: string
  consoleErrors: string[]
}

export interface DebugReport {
  project: string
  version: string
  build: string
  totalSteps: number
  passed: number
  failedAt?: number
  failedStep?: string
  results: StepResult[]
  autoFixPrompt?: string
  timestamp: string
}

export class AutoDebugRunner {
  private steps: DebugStep[]
  private results: StepResult[] = []
  private capturedErrors: string[] = []
  private project: string
  private version: string
  private build: string

  constructor(project: string, version: string, build: string, steps: DebugStep[]) {
    this.project = project
    this.version = version
    this.build = build
    this.steps = steps
  }

  private setupErrorCapture() {
    const orig = console.error.bind(console)
    console.error = (...args: unknown[]) => {
      this.capturedErrors.push(args.map(String).join(' '))
      orig(...args)
    }
  }

  private async runStep(step: DebugStep): Promise<StepResult> {
    const start = Date.now()
    const errsBefore = this.capturedErrors.length
    console.log(`[AutoDebug] ▶ Step ${step.id}: ${step.name}`)

    try {
      await Promise.race([
        Promise.resolve(step.action()),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('STEP_TIMEOUT')), step.timeout ?? 5000)
        ),
      ])

      const newErrors = this.capturedErrors.slice(errsBefore)
      return {
        stepId: step.id,
        stepName: step.name,
        status: newErrors.length === 0 ? 'pass' : 'fail',
        duration: Date.now() - start,
        error: newErrors.length > 0 ? newErrors.join('; ') : undefined,
        consoleErrors: newErrors,
      }
    } catch (e) {
      const err = e as Error
      const isTimeout = err.message === 'STEP_TIMEOUT'
      return {
        stepId: step.id,
        stepName: step.name,
        status: isTimeout ? 'timeout' : 'crash',
        duration: Date.now() - start,
        error: err.message,
        stackTrace: !isTimeout ? err.stack : undefined,
        consoleErrors: this.capturedErrors.slice(errsBefore),
      }
    }
  }

  async run(onStepComplete?: (result: StepResult) => void): Promise<DebugReport> {
    this.results = []
    this.capturedErrors = []
    this.setupErrorCapture()

    let failedAt: number | undefined
    let failedStep: string | undefined

    for (const step of this.steps) {
      const result = await this.runStep(step)
      this.results.push(result)
      onStepComplete?.(result)

      if (result.status === 'crash' || result.status === 'timeout') {
        failedAt = step.id
        failedStep = step.name
        break
      }
    }

    const report: DebugReport = {
      project: this.project,
      version: this.version,
      build: this.build,
      totalSteps: this.steps.length,
      passed: this.results.filter(r => r.status === 'pass').length,
      failedAt,
      failedStep,
      results: this.results,
      timestamp: new Date().toISOString(),
    }

    if (failedAt) {
      report.autoFixPrompt = this.generateFixPrompt(report)
    }

    return report
  }

  private generateFixPrompt(report: DebugReport): string {
    const failed = report.results.find(r => r.stepId === report.failedAt)
    if (!failed) return ''

    const passed = report.results
      .filter(r => r.stepId < report.failedAt!)
      .map(r => `  ✅ Step ${r.stepId}: ${r.stepName} (${r.duration}ms)`)
      .join('\n')

    return `## AUTO-FIX: ${report.project} v${report.version} (${report.build}) crashed at Step ${report.failedAt}

Yes, allow all edits in components
Project: /c/Projects/${report.project}

## Steps that PASSED:
${passed || '  (none)'}

## CRASHED HERE:
  ❌ Step ${failed.stepId}: ${failed.stepName}
  Status: ${failed.status}
  Error: ${failed.error ?? 'unknown'}
  Stack: ${failed.stackTrace ?? 'N/A'}
  Console: ${failed.consoleErrors.join('\\n') || 'none'}

## TASK
1. Read the code related to "${failed.stepName}"
2. Find the exact line causing the ${failed.status}
3. Fix it
4. Build: npx tsc --noEmit && npx expo export --platform web
5. Commit + push

## DEFINITION OF DONE
- Step ${report.failedAt} passes
- All previous steps still pass
- TypeScript clean`
  }
}
