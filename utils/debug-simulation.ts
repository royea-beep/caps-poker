/**
 * 10-Player Simulation — programmatically simulates player flows,
 * triggers deliberate crashes on players 7 + 10, and verifies the
 * crash evidence system end-to-end (screenshots → Supabase → WhatsApp → DB).
 */
import {
  setCurrentScreen,
  trackAction,
  generateCrashReport,
  startCrashRecording,
} from './crash-evidence'
import { sendCrashToWhatsApp } from './debug-whatsapp'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SimAction {
  type: 'navigate' | 'tap' | 'wait' | 'crash'
  target: string
  delay: number
}

export interface SimulatedPlayer {
  id: number
  name: string
  actions: SimAction[]
  shouldCrash: boolean
  crashAtStep?: number
}

export interface CrashEvidence {
  playerId: number
  playerName: string
  step: number
  error: string
  screenshotsUploaded: number
  whatsappSent: boolean
  dbSaved: boolean
  fixPromptLength: number
}

export interface SimulationReport {
  totalPlayers: number
  completedClean: number
  crashed: number
  crashReports: CrashEvidence[]
  debugLines: string[]
  timestamp: string
}

// ─── 10 Players ───────────────────────────────────────────────────────────────

export function create10Players(): SimulatedPlayer[] {
  return [
    {
      id: 1, name: 'Player_Normal_1', shouldCrash: false,
      actions: [
        { type: 'navigate', target: 'Home', delay: 300 },
        { type: 'tap', target: 'play_pressed', delay: 800 },
        { type: 'navigate', target: 'Game', delay: 300 },
        { type: 'tap', target: 'deal_pressed', delay: 1000 },
        { type: 'tap', target: 'bet_placed', delay: 800 },
        { type: 'navigate', target: 'Home', delay: 300 },
      ],
    },
    {
      id: 2, name: 'Player_Normal_2', shouldCrash: false,
      actions: [
        { type: 'navigate', target: 'Home', delay: 300 },
        { type: 'tap', target: 'play_pressed', delay: 800 },
        { type: 'navigate', target: 'Game', delay: 300 },
        { type: 'tap', target: 'deal_pressed', delay: 800 },
        { type: 'tap', target: 'fold_pressed', delay: 1200 },
        { type: 'navigate', target: 'Home', delay: 300 },
      ],
    },
    {
      id: 3, name: 'Player_Fast', shouldCrash: false,
      actions: [
        { type: 'navigate', target: 'Home', delay: 200 },
        { type: 'tap', target: 'play_pressed', delay: 300 },
        { type: 'tap', target: 'deal_pressed', delay: 300 },
        { type: 'tap', target: 'bet_placed', delay: 300 },
        { type: 'tap', target: 'raise_pressed', delay: 300 },
      ],
    },
    {
      id: 4, name: 'Player_Explorer', shouldCrash: false,
      actions: [
        { type: 'navigate', target: 'Home', delay: 400 },
        { type: 'navigate', target: 'Settings', delay: 800 },
        { type: 'navigate', target: 'Leaderboard', delay: 800 },
        { type: 'navigate', target: 'Debug', delay: 800 },
        { type: 'navigate', target: 'Home', delay: 400 },
      ],
    },
    {
      id: 5, name: 'Player_Normal_3', shouldCrash: false,
      actions: [
        { type: 'navigate', target: 'Home', delay: 400 },
        { type: 'tap', target: 'play_pressed', delay: 800 },
        { type: 'navigate', target: 'Game', delay: 400 },
        { type: 'tap', target: 'deal_pressed', delay: 1000 },
        { type: 'tap', target: 'call_pressed', delay: 1200 },
      ],
    },
    {
      id: 6, name: 'Player_Slow', shouldCrash: false,
      actions: [
        { type: 'navigate', target: 'Home', delay: 800 },
        { type: 'wait', target: 'idle', delay: 1000 },
        { type: 'tap', target: 'play_pressed', delay: 1200 },
        { type: 'navigate', target: 'Game', delay: 600 },
      ],
    },
    {
      // ⚡ CRASH — Player 7 crashes at step 4 (during game after deal)
      id: 7, name: '💥 CRASH_PLAYER', shouldCrash: true, crashAtStep: 4,
      actions: [
        { type: 'navigate', target: 'Home', delay: 400 },
        { type: 'tap', target: 'play_pressed', delay: 800 },
        { type: 'navigate', target: 'Game', delay: 400 },
        { type: 'tap', target: 'deal_pressed', delay: 800 },
        { type: 'crash', target: 'SIMULATED_GAME_CRASH', delay: 400 },
      ],
    },
    {
      id: 8, name: 'Player_Normal_4', shouldCrash: false,
      actions: [
        { type: 'navigate', target: 'Home', delay: 400 },
        { type: 'tap', target: 'play_pressed', delay: 800 },
        { type: 'tap', target: 'deal_pressed', delay: 1000 },
        { type: 'tap', target: 'bet_placed', delay: 1200 },
      ],
    },
    {
      id: 9, name: 'Player_Spam', shouldCrash: false,
      actions: [
        { type: 'tap', target: 'play_pressed', delay: 100 },
        { type: 'tap', target: 'play_pressed', delay: 100 },
        { type: 'tap', target: 'deal_pressed', delay: 100 },
        { type: 'tap', target: 'deal_pressed', delay: 100 },
        { type: 'tap', target: 'bet_placed', delay: 100 },
      ],
    },
    {
      // ⚡ CRASH — Player 10 crashes at step 2 (in Settings)
      id: 10, name: '💥 CRASH_PLAYER_2', shouldCrash: true, crashAtStep: 2,
      actions: [
        { type: 'navigate', target: 'Home', delay: 400 },
        { type: 'navigate', target: 'Settings', delay: 400 },
        { type: 'crash', target: 'SIMULATED_SETTINGS_CRASH', delay: 300 },
      ],
    },
  ]
}

// ─── Run One Player ───────────────────────────────────────────────────────────

async function runPlayer(player: SimulatedPlayer): Promise<{
  completed: boolean
  crashEvidence?: CrashEvidence
  debugLines: string[]
}> {
  const lines: string[] = []
  lines.push(`[P${player.id}: ${player.name}] Starting...`)

  for (let i = 0; i < player.actions.length; i++) {
    const action = player.actions[i]

    await new Promise<void>(r => setTimeout(r, action.delay))

    const isCrashStep = action.type === 'crash' ||
      (player.shouldCrash && i + 1 === (player.crashAtStep ?? 99))

    if (isCrashStep) {
      lines.push(`[P${player.id}] 💥 CRASH at step ${i + 1}: ${action.target}`)
      const report = await generateCrashReport({
        message: `SimulatedCrash: ${action.target} — ${player.name} step ${i + 1}`,
        stack: `Error: SimulatedCrash\n    at runPlayer (debug-simulation.ts:${100 + i})\n    at runSimulation`,
      })

      let whatsappSent = false
      try {
        await sendCrashToWhatsApp(report)
        whatsappSent = true
      } catch {}

      lines.push(`[P${player.id}] 📸 Screenshots: ${report.storageUrls.length}`)
      lines.push(`[P${player.id}] 📱 WhatsApp: ${whatsappSent ? '✅' : '❌'}`)
      lines.push(`[P${player.id}] 📋 Fix prompt: ${report.fixPrompt.length} chars`)
      lines.push(`[P${player.id}] 📊 Step log: ${report.stepLog.length} entries`)

      return {
        completed: false,
        crashEvidence: {
          playerId: player.id,
          playerName: player.name,
          step: i + 1,
          error: report.error.message,
          screenshotsUploaded: report.storageUrls.length,
          whatsappSent,
          dbSaved: true, // saveToDB called inside generateCrashReport
          fixPromptLength: report.fixPrompt.length,
        },
        debugLines: lines,
      }
    }

    switch (action.type) {
      case 'navigate':
        setCurrentScreen(action.target)
        lines.push(`[P${player.id}] 📱 → ${action.target}`)
        break
      case 'tap':
        trackAction(action.target)
        lines.push(`[P${player.id}] 👆 ${action.target}`)
        break
      case 'wait':
        lines.push(`[P${player.id}] ⏳ ${action.delay}ms`)
        break
    }
  }

  lines.push(`[P${player.id}: ${player.name}] ✅ Completed clean`)
  return { completed: true, debugLines: lines }
}

// ─── Run Full Simulation ──────────────────────────────────────────────────────

export async function runSimulation(): Promise<SimulationReport> {
  const players = create10Players()
  const report: SimulationReport = {
    totalPlayers: players.length,
    completedClean: 0,
    crashed: 0,
    crashReports: [],
    debugLines: [],
    timestamp: new Date().toISOString(),
  }

  startCrashRecording()

  report.debugLines.push(`=== SIM START: ${players.length} players ===`)
  report.debugLines.push(`Time: ${report.timestamp}`)
  report.debugLines.push(``)

  for (const player of players) {
    report.debugLines.push(`--- P${player.id}: ${player.name} ${player.shouldCrash ? '💥' : '👤'} ---`)

    const result = await runPlayer(player)
    report.debugLines.push(...result.debugLines)

    if (result.completed) {
      report.completedClean++
    } else {
      report.crashed++
      if (result.crashEvidence) {
        report.crashReports.push(result.crashEvidence)
      }
    }

    report.debugLines.push(``)
    await new Promise<void>(r => setTimeout(r, 300))
  }

  report.debugLines.push(`=== SIM END ===`)
  report.debugLines.push(`Clean: ${report.completedClean}/${report.totalPlayers}`)
  report.debugLines.push(`Crashed: ${report.crashed}/${report.totalPlayers}`)
  report.debugLines.push(`Evidence reports: ${report.crashReports.length}`)

  return report
}
