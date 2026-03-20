# Stage 8: Live Optimization — Caps Poker MEGA PROMPT Template
**For:** Any live-optimization sprint on Caps Poker
**Stage:** live_optimization | Current score: 13/20
**Use when:** App is live, working on post-launch improvements, analytics, user feedback loop

---

## CONTEXT (pre-filled for Caps)
- v1.9.3 | Code b104 | EAS #117 | caps.ftable.co.il
- Stack: React Native + Expo SDK 55 + Supabase + Vercel
- Iron Rules: See MEMORY.md — Rule 1 (RN+Expo only), Rule 2 UNLOCKED (landscape)
- Methodology: VAMOS sprints, numbered output, autonomous execution
- Current stage score: 13/20 → target 20/20

## LOCKED DECISIONS
- React Native + Expo only — no bare workflow, no Capacitor
- All game params runtime-configurable via Settings — never hardcoded
- No backend for single-player — local storage only
- Web deploy: `cd dist && vercel --prod --yes` (NEVER FTP, NEVER web-dist/)
- Supabase creds from Constants.expoConfig.extra (NOT process.env.EXPO_PUBLIC_*)

## STAGE 8 CHECKLIST (paste relevant items into TASK section)
- [ ] Twilio webhook URL set in Console → WhatsApp bot fully live
- [ ] Google OAuth — enable Google provider in Supabase + Cloud Console redirect URI
- [ ] Device QA — Five-O theme, landscape, multiplayer, WhatsApp audio E2E
- [ ] Analytics dashboard — Supabase queries on learning_events + bug_reports
- [ ] Auto web deploy on push (GitHub Actions → vercel --prod)
- [ ] App Store track (SKIP until explicitly told to resume)
- [ ] User metrics — DAU, retention, session length (post real-user launch)
- [ ] A/B testing infrastructure

## TEMPLATE

```
## CAPS POKER — [SPRINT NAME]

## CONTEXT
v1.9.3 | Code b104 | EAS #117 | Stage: live_optimization (13/20)
[Describe specific problem or goal for this sprint]

## LOCKED DECISIONS
- React Native + Expo only
- Iron Rules from MEMORY.md apply
- Fix autonomously — escalate only if truly blocked on ONE question

## TASK
**Step 1** — [...]
**Step 2** — [...]

## CONSTRAINTS
- Build must pass after every change
- Run TypeScript check: `npx tsc --noEmit`
- Run tests: `npx jest --passWithNoTests`
- Web export: expo export → fix-web-html.js → vercel --prod

## DEFINITION OF DONE
- [ ] Specific testable criterion 1
- [ ] Specific testable criterion 2
- [ ] TypeScript: 0 errors
- [ ] git commit + push
- [ ] MEMORY.md updated with new status
```

## WHAT BRINGS STAGE 8 TO 20/20
1. Twilio webhook set → WhatsApp bot receiving real messages (+1)
2. Full device QA pass (Five-O, landscape, WhatsApp audio) (+1)
3. Real users installed + using app (+2)
4. Analytics dashboard showing real usage data (+1)
5. Iteration loop: bug → fix → release at least 2 cycles (+1)
6. Growth/viral feature (invite friends, share score) (+1)
