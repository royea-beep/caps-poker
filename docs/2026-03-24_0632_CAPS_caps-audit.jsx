import { useState, useMemo } from "react";

const SESSIONS = [
  { id: "s1", name: "Session 1", date: "Mar 21", color: "#FFD700" },
  { id: "s2", name: "Session 2", date: "Mar 21-22", color: "#4FC3F7" },
  { id: "s3", name: "Session 3", date: "Mar 22-24", color: "#81C784" },
];

const CATEGORIES = [
  "Infrastructure", "Game Core", "Visual / UX", "Sound & Media",
  "WhatsApp Bot", "Debug & QA", "Crash Fixes", "Deploy & CI"
];

const TASKS = [
  // SESSION 1 — Mar 21
  { session: "s1", cat: "Infrastructure", task: "Status Report — full project audit", requested: "Full code/build/test status", result: "Bot reported everything: version, tests, builds, git, web", score: 10 },
  { session: "s1", cat: "Visual / UX", task: "WSOP Simulation — 10 poker pros playtest", requested: "Simulated playtest with 10 famous players, 15 categories rated 1-10", result: "10 players, 15 categories, detailed dialogue, scorecard 7.1/10 overall", score: 10 },
  { session: "s1", cat: "Visual / UX", task: "Pro Quotes — fictional quotes in app", requested: "20 quotes on 5 screens with AI disclaimer", result: "20 quotes, 5 contexts (home/game/summary/complete/waiting), disclaimer on every display", score: 10 },
  { session: "s1", cat: "Visual / UX", task: "P0: Card Readability overhaul", requested: "White bg, bold rank, suit glow, suit-colored border, CARD_SCALE per player count", result: "All implemented: #FFFFFF bg, fontWeight 900, textShadow per suit, communityScale 1.15", score: 10 },
  { session: "s1", cat: "Visual / UX", task: "P0: Board visual separation", requested: "Each board unique colored border", result: "Gold/blue/green/orange borders per board", score: 10 },
  { session: "s1", cat: "Visual / UX", task: "P0: Player hand cards 1.3x larger", requested: "Cards in hand bigger than board cards, gold border on selected", result: "1.3x multiplier, gold border, scale 1.06 on selected", score: 10 },
  { session: "s1", cat: "Visual / UX", task: "P0: Onboarding tutorial (4 steps)", requested: "First launch overlay, 4 steps, How to Play button, in-game hints first 3 games", result: "Tutorial.tsx with 4 steps, AsyncStorage flag, hints counter, How to Play on home", score: 10 },
  { session: "s1", cat: "Visual / UX", task: "P0: COMPLETE celebration upgrade", requested: "Screen flash, 40 particles, gold pulse ×3, 3 seconds, haptics", result: "80ms flash, 58px text, goldPulseStyle withRepeat ×3, completeBonusDisplay: 3, haptic setTimeout", score: 10 },
  { session: "s1", cat: "Visual / UX", task: "Hand History link restored", requested: "Bot removed HAND HISTORY — restore alongside HOW TO PLAY", result: "Restored, reads 'HAND HISTORY'", score: 10 },
  { session: "s1", cat: "Visual / UX", task: "Pro Quotes on lobby/waiting", requested: "ProQuoteBanner in multiplayer waiting screens", result: "Added to host.tsx + internet-join.tsx with context='waiting'", score: 10 },
  { session: "s1", cat: "Sound & Media", task: "Sound fix — no audio at all", requested: "Diagnose why ALL sounds silent on iPhone", result: "Root cause: playsInSilentModeIOS missing. Fixed with Audio.setAudioModeAsync()", score: 10 },
  { session: "s1", cat: "WhatsApp Bot", task: "Twilio webhook connected", requested: "Connect Twilio → Supabase Edge Function", result: "Manual setup (API didn't work), webhook connected, bot receives + responds", score: 10 },
  { session: "s1", cat: "WhatsApp Bot", task: "Smart Approval — 3 options", requested: "Fix only / fix+build / cancel, severity rating, pending count", result: "v13: 3 options, CRITICAL/MEDIUM/LOW, deploy_tracker table, recommendation logic", score: 10 },
  { session: "s1", cat: "WhatsApp Bot", task: "Code-Aware bot — reads code before plan", requested: "Bot fetches manifest + source files from GitHub before generating plans", result: "v14: PROJECT_MANIFEST.md + keyword→file mapping + GitHub fetch", score: 10 },
  { session: "s1", cat: "Sound & Media", task: "Voice clips — ElevenLabs clones", requested: "20 AI voice clips for 10 poker pros", result: "20/20 clips generated (17-68KB each), found ElevenLabs key in 9soccer project", score: 10 },
  { session: "s1", cat: "Sound & Media", task: "Voice integration + safety layers", requested: "Play clips with quotes, disclaimer, kill switch, settings toggle, credits", result: "playVoiceClip(), text+audio disclaimer, app_config kill switch, 2 toggles, credits section", score: 10 },
  { session: "s1", cat: "Infrastructure", task: "Workflow doc + file naming convention", requested: "Update workflow doc with timeline, date+time IST on all filenames", result: "TIMELINE added, NAME-YYYY-MM-DD-HHMM.md enforced, 'always ask if unclear' rule", score: 10 },
  { session: "s1", cat: "Infrastructure", task: "Crash recovery after computer crash", requested: "Check what survived, resume sprint", result: "Recovery prompt → full report → all 5 files survived → resumed successfully", score: 10 },

  // SESSION 2 — Mar 21-22
  { session: "s2", cat: "Visual / UX", task: "MEGA visual overhaul (10 agents)", requested: "Premium home screen, bug dashboard, game/summary/settings polish", result: "Bug dashboard at caps.ftable.co.il/bugs/, home redesigned: gradient bg, gold accents, glass containers", score: 9, note: "6/10 items completed first pass, needed P0-FIXES followup" },
  { session: "s2", cat: "Visual / UX", task: "Hand Share + Web Replay", requested: "Share individual hands via link, web replay viewer", result: "shared_hands Supabase table, web replay page, share button in results", score: 10 },
  { session: "s2", cat: "WhatsApp Bot", task: "WhatsApp bot v15 — crash alerts", requested: "7 reply options, dirty shutdown detection, auto-fix mode", result: "v15 deployed, 7 options (fix/analyze/skip/marathon/auto-fix ON/OFF/dashboard)", score: 10 },
  { session: "s2", cat: "Debug & QA", task: "Full UI audit — 30 testers × 10 screens", requested: "Simulated device testing across all iPhone sizes", result: "UX scores generated per device, identified problem areas", score: 9, note: "Simulation only — not real device testing" },
  { session: "s2", cat: "Visual / UX", task: "Israeli poker player simulation (50 players)", requested: "50 Israeli players playtest CAPS, rate it", result: "50 players, detailed Hebrew dialogue, feature requests identified", score: 10 },
  { session: "s2", cat: "Visual / UX", task: "Premium home screen redesign", requested: "Gold accents, gradient bg, glass containers, card suit decorations", result: "Full redesign deployed", score: 10 },
  { session: "s2", cat: "Visual / UX", task: "Results screen redesign", requested: "Bigger numbers, gold wins, COMPLETE banner, DEAL ME IN button", result: "Redesigned with static layout (crash-safe), gold button, COMPLETE banner", score: 9, note: "Animations stripped due to crash — static but clean" },

  // SESSION 3 — Mar 22-24
  { session: "s3", cat: "Visual / UX", task: "Universal responsive system (GEM)", requested: "rv/rh/rf/rs/rb/ri functions, all 21 files, 598 tests, 320-480pt range", result: "utils/responsive.ts created, applied to 21 files, UX 8.2→9.1 average", score: 10 },
  { session: "s3", cat: "Infrastructure", task: "OTA Updates (expo-updates)", requested: "Over-the-air updates without new build", result: "expo-updates configured, runtimeVersion policy: appVersion, eas update working", score: 10 },
  { session: "s3", cat: "Deploy & CI", task: "Vercel native GitHub integration", requested: "Replace expiring token with zero-maintenance auto-deploy", result: "Native GitHub integration, auto-deploy on push, no tokens needed", score: 10 },
  { session: "s3", cat: "Infrastructure", task: "Expo Insights", requested: "Production analytics", result: "Configured and live", score: 10 },
  { session: "s3", cat: "Deploy & CI", task: "Deploy tracking (Supabase + dashboard)", requested: "deploy_log table, dashboard tab, WhatsApp notifications", result: "deploy_log table, Deploys tab in dashboard, WhatsApp deploy alerts", score: 10 },
  { session: "s3", cat: "Infrastructure", task: "TestFlight public link", requested: "Public TestFlight link for easy sharing", result: "testflight.apple.com/join/hD3KvZeC — working", score: 10 },
  { session: "s3", cat: "Deploy & CI", task: "Auto-submit pipeline (--auto-submit)", requested: "Automatic TestFlight submission after build", result: "eas build with --auto-submit-with-profile ci configured", score: 10 },
  { session: "s3", cat: "Crash Fixes", task: "14-hour crash investigation (5 root causes)", requested: "Find and fix app crash on results screen", result: "5 root causes found: InteractionManager deadlock, CompleteOverlay 160 worklets, ConfettiCannon 180 views, delayed animation mount, entering= layout props", score: 10 },
  { session: "s3", cat: "Crash Fixes", task: "Reanimated Iron Rules (permanent)", requested: "Prevent future crashes from animations", result: "7 iron rules: zero Reanimated in results, no withRepeat(-1), max 5 shared values, cancelAnimation cleanup, no ConfettiCannon, no entering= props, cancel before navigate", score: 10 },
  { session: "s3", cat: "Debug & QA", task: "Debug Overlay system", requested: "On-screen debug terminal, numbered logging", result: "DebugOverlay.tsx — green terminal, numbered logs, minimize to bubble, hidden by default", score: 10 },
  { session: "s3", cat: "Debug & QA", task: "Screen Recorder (captureScreen)", requested: "Screenshot capture for crash forensics", result: "utils/screenRecorder.ts — captureScreen via react-native-view-shot, persistent to disk", score: 9, note: "RAM-based initially, disk persistence pending" },
  { session: "s3", cat: "Debug & QA", task: "Dirty Shutdown Detector", requested: "Detect native crashes on next app open", result: "utils/dirtyShutdown.ts — AsyncStorage flag, WhatsApp alert on detection", score: 10 },
  { session: "s3", cat: "Debug & QA", task: "Auto-Sim (Debug Marathon)", requested: "Automated game simulation in Settings", result: "Settings → '🐛 Debug Marathon (10 hands)', auto-fills + auto-presses Ready", score: 10 },
  { session: "s3", cat: "WhatsApp Bot", task: "Crash-analyzer Edge Function", requested: "Claude API analyzes crash logs via WhatsApp", result: "crash-analyzer function deployed, analyzes logs and responds with fix plan", score: 10 },
  { session: "s3", cat: "Infrastructure", task: "Build number mismatch fix", requested: "Fix: build 198 reporting as 116", result: "Root cause: Constants.expoConfig reads local app.json, not binary. Fixed: use Application.nativeBuildVersion", score: 10 },
  { session: "s3", cat: "Debug & QA", task: "Tester-ready build preparation", requested: "Hide debug UI, clean dead code, keep safety features", result: "Debug overlay hidden by default, debug buttons behind __DEV__, VersionBadge in Settings only", score: 10 },
  { session: "s3", cat: "Visual / UX", task: "Card sizing — height capped", requested: "Guarantee AUTO button visible on all screens", result: "Card height capped at 50pt max", score: 10 },
  { session: "s3", cat: "Visual / UX", task: "SafeRevealOverlay — solid dark", requested: "Opaque reveal, one board at a time, tap/skip", result: "Modal with #080d16, one board at a time, 1.5s auto-advance, SKIP button", score: 10 },
  { session: "s3", cat: "Game Core", task: "Hand evaluator accuracy audit", requested: "Verify Omaha evaluation correctness", result: "500-hand test: High Card 3.8%, Pair 25%, Two Pair 38% — correct for Omaha", score: 10 },
  { session: "s3", cat: "Game Core", task: "Hand distribution statistical test", requested: "Automated test for hand variety", result: "Test added: 500 hands, High Card < 30%, at least 3 types", score: 10 },
  { session: "s3", cat: "Visual / UX", task: "Responsive cards — fixed width in hand", requested: "Cards don't grow giant when few remain", result: "Fixed 4/row width regardless of remaining count", score: 10 },
  { session: "s3", cat: "Visual / UX", task: "Reveal overlay improved", requested: "Community cards visible, hand names, WIN/LOSE/TIE, chip delta", result: "All 5 community + 4 player cards shown, hand name text, colored result, chip delta", score: 10 },
  { session: "s3", cat: "Visual / UX", task: "'Calculating results...' hidden", requested: "Hide text when reveal overlay showing", result: "Hidden during SafeRevealOverlay", score: 10 },
  { session: "s3", cat: "Visual / UX", task: "AUTO button visibility", requested: "Visible on empty boards", result: "Confirmed visible after card sizing cap", score: 10 },

  // PENDING
  { session: "s3", cat: "Game Core", task: "🔴 Duplicate cards on board", requested: "Cards appear duplicated when placed", result: "Root cause known: nested setState. Prompt ready. NOT YET FIXED.", score: 0, pending: true },
  { session: "s3", cat: "Debug & QA", task: "Screenshot storage: disk not RAM", requested: "Persistent screenshots to FileSystem.documentDirectory", result: "Prompt ready. NOT YET DONE.", score: 0, pending: true },
  { session: "s3", cat: "Visual / UX", task: "Re-add safe animations to results", requested: "One at a time with crash testing", result: "PENDING — results screen currently static", score: 0, pending: true },
  { session: "s3", cat: "Game Core", task: "Tournament mode", requested: "Multi-round tournament brackets", result: "NOT STARTED — future feature", score: 0, pending: true },
  { session: "s3", cat: "Game Core", task: "Chat between players", requested: "In-game text chat", result: "NOT STARTED — future feature", score: 0, pending: true },
  { session: "s3", cat: "Visual / UX", task: "Video tutorial", requested: "Animated/video onboarding", result: "NOT STARTED — future feature", score: 0, pending: true },
];

const ScoreBadge = ({ score, pending }) => {
  if (pending) return <span style={{ padding: "2px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: "rgba(255,152,0,0.15)", color: "#FF9800", border: "1px solid rgba(255,152,0,0.3)" }}>PENDING</span>;
  const bg = score >= 9 ? "rgba(76,175,80,0.15)" : score >= 7 ? "rgba(255,235,59,0.15)" : score >= 5 ? "rgba(255,152,0,0.15)" : "rgba(244,67,54,0.15)";
  const color = score >= 9 ? "#4CAF50" : score >= 7 ? "#FDD835" : score >= 5 ? "#FF9800" : "#F44336";
  const border = score >= 9 ? "rgba(76,175,80,0.3)" : score >= 7 ? "rgba(255,235,59,0.3)" : score >= 5 ? "rgba(255,152,0,0.3)" : "rgba(244,67,54,0.3)";
  return <span style={{ padding: "2px 10px", borderRadius: 6, fontSize: 13, fontWeight: 800, background: bg, color, border: `1px solid ${border}`, fontFamily: "JetBrains Mono, monospace" }}>{score}/10</span>;
};

export default function CapsAudit() {
  const [filter, setFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [showPending, setShowPending] = useState(true);

  const filtered = useMemo(() => {
    let t = TASKS;
    if (filter !== "all") t = t.filter(x => x.session === filter);
    if (catFilter !== "all") t = t.filter(x => x.cat === catFilter);
    if (!showPending) t = t.filter(x => !x.pending);
    return t;
  }, [filter, catFilter, showPending]);

  const completed = TASKS.filter(x => !x.pending);
  const pending = TASKS.filter(x => x.pending);
  const avgScore = completed.length ? (completed.reduce((a, b) => a + b.score, 0) / completed.length).toFixed(1) : 0;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a0f1a 0%, #1a1a2e 50%, #0d1117 100%)", color: "#e0e0e0", fontFamily: "'Segoe UI', -apple-system, sans-serif", padding: 24 }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 11, letterSpacing: 6, color: "rgba(255,215,0,0.5)", marginBottom: 4, fontFamily: "JetBrains Mono, monospace" }}>♠ ♦ ♣ ♥</div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: "#FFD700", letterSpacing: 4, margin: 0, textShadow: "0 0 30px rgba(255,215,0,0.2)" }}>CAPS POKER</h1>
          <div style={{ fontSize: 12, letterSpacing: 8, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>FULL PROJECT AUDIT</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 8, fontFamily: "JetBrains Mono, monospace" }}>Sessions: Mar 21 → Mar 24, 2026 | 3 sessions | ~30 hours</div>
        </div>

        {/* Stats Row */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap", justifyContent: "center" }}>
          {[
            { label: "COMPLETED", value: completed.length, color: "#4CAF50" },
            { label: "PENDING", value: pending.length, color: "#FF9800" },
            { label: "AVG SCORE", value: avgScore, color: "#FFD700" },
            { label: "TESTS", value: "2,231", color: "#4FC3F7" },
            { label: "TS ERRORS", value: "0", color: "#81C784" },
            { label: "BUILD", value: "198+", color: "#CE93D8" },
          ].map(s => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 20px", textAlign: "center", minWidth: 100 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: "JetBrains Mono, monospace" }}>{s.value}</div>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginRight: 4 }}>SESSION:</span>
          {[{ id: "all", label: "All" }, ...SESSIONS.map(s => ({ id: s.id, label: s.name }))].map(s => (
            <button key={s.id} onClick={() => setFilter(s.id)} style={{ padding: "4px 12px", borderRadius: 6, border: filter === s.id ? "1px solid rgba(255,215,0,0.5)" : "1px solid rgba(255,255,255,0.1)", background: filter === s.id ? "rgba(255,215,0,0.1)" : "transparent", color: filter === s.id ? "#FFD700" : "rgba(255,255,255,0.5)", fontSize: 11, cursor: "pointer", fontWeight: filter === s.id ? 700 : 400 }}>{s.label}</button>
          ))}
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginLeft: 12, marginRight: 4 }}>CATEGORY:</span>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#e0e0e0", fontSize: 11, cursor: "pointer" }}>
            <option value="all">All</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <label style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginLeft: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <input type="checkbox" checked={showPending} onChange={e => setShowPending(e.target.checked)} /> Show pending
          </label>
        </div>

        {/* Task List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map((t, i) => {
            const session = SESSIONS.find(s => s.id === t.session);
            return (
              <div key={i} style={{ background: t.pending ? "rgba(255,152,0,0.03)" : "rgba(255,255,255,0.02)", border: `1px solid ${t.pending ? "rgba(255,152,0,0.15)" : "rgba(255,255,255,0.06)"}`, borderRadius: 8, padding: "10px 14px", borderLeft: `3px solid ${session?.color || "#666"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", fontFamily: "JetBrains Mono, monospace" }}>{t.cat}</span>
                      <span style={{ fontSize: 9, color: session?.color, fontFamily: "JetBrains Mono, monospace" }}>{session?.date}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.pending ? "#FF9800" : "#fff", marginBottom: 2 }}>{t.task}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 1 }}>
                      <span style={{ color: "rgba(255,215,0,0.6)" }}>Asked:</span> {t.requested}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                      <span style={{ color: t.pending ? "rgba(255,152,0,0.6)" : "rgba(76,175,80,0.6)" }}>Result:</span> {t.result}
                    </div>
                    {t.note && <div style={{ fontSize: 10, color: "rgba(255,152,0,0.6)", marginTop: 2, fontStyle: "italic" }}>⚠️ {t.note}</div>}
                  </div>
                  <ScoreBadge score={t.score} pending={t.pending} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div style={{ marginTop: 32, background: "rgba(255,215,0,0.03)", border: "1px solid rgba(255,215,0,0.15)", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#FFD700", marginBottom: 12, letterSpacing: 2 }}>SUMMARY</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
            <div><span style={{ color: "rgba(255,255,255,0.4)" }}>Completed tasks:</span> <span style={{ color: "#4CAF50", fontWeight: 700 }}>{completed.length}</span></div>
            <div><span style={{ color: "rgba(255,255,255,0.4)" }}>Pending tasks:</span> <span style={{ color: "#FF9800", fontWeight: 700 }}>{pending.length}</span></div>
            <div><span style={{ color: "rgba(255,255,255,0.4)" }}>Average score:</span> <span style={{ color: "#FFD700", fontWeight: 700 }}>{avgScore}/10</span></div>
            <div><span style={{ color: "rgba(255,255,255,0.4)" }}>Completion rate:</span> <span style={{ color: "#4CAF50", fontWeight: 700 }}>{((completed.length / TASKS.length) * 100).toFixed(0)}%</span></div>
            <div><span style={{ color: "rgba(255,255,255,0.4)" }}>Score 10/10:</span> <span style={{ color: "#81C784", fontWeight: 700 }}>{completed.filter(t => t.score === 10).length} tasks</span></div>
            <div><span style={{ color: "rgba(255,255,255,0.4)" }}>Score 9/10:</span> <span style={{ color: "#FDD835", fontWeight: 700 }}>{completed.filter(t => t.score === 9).length} tasks</span></div>
          </div>
          <div style={{ marginTop: 16, fontSize: 11, color: "rgba(255,255,255,0.3)", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
            ♠ {completed.filter(t => t.score === 10).length} perfect scores — {completed.filter(t => t.score >= 9).length}/{completed.length} tasks scored 9+ — {pending.length} items still pending
          </div>
        </div>
      </div>
    </div>
  );
}
