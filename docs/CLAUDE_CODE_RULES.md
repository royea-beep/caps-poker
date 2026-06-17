# CLAUDE.md — CAPS Poker (for Claude Code)

This file is read at the start of every Claude Code session. Place at repo root.

## Project at a glance

- **CAPS Poker** — multi-board poker mobile game, React Native + Expo SDK 55
- Repo: `royea-beep/caps-poker` • Local: `C:/Projects/POKER/Caps`
- Supabase project_id: `gxrpunvhjcrzqnitbqah`
- Backend EFs, EAS native iOS, Vercel web (caps.ftable.co.il)

## Mandatory startup steps

1. `git status` — confirm clean working tree
2. `git branch --show-current` — confirm not on `main`
3. `git fetch && git log main..HEAD --oneline` — show commits ahead of main
4. `eval "$(fnm env --use-on-cd 2>/dev/null)" && node --version` — init Node
5. `which tsc || ls node_modules/.bin/tsc` — confirm TypeScript path

## Hard rules (do not violate)

- **NEVER commit directly to `main`.** Always: branch → push → PR → squash-merge
- **NEVER use `npx tsc`.** Use `./node_modules/.bin/tsc --noEmit`
- **NEVER use `--no-verify`** unless fnm Option A fails. Document in commit body if used
- **NEVER assume "build passed last time" = "config still valid"** — always verify via `git diff main`
- **NEVER touch:** `Card.tsx` Classic branch (lines 365-391), brown noise ambient, drag/drop handlers in PlayerHand, Hebrew strings, cup tier system, IAP, gates, tabs
- **NEVER edit `eas.json` channel field** — it's IGNORED by `ios-testflight.yml` (uses `expo prebuild + xcodebuild`). Channel lives in `app.json → updates.requestHeaders.expo-channel-name = "production"`

## Architecture (locked May 4, b370)

- **Stacked-only layout** for ALL board counts. NO multi-column.
- Card scale ladder: 2 boards=1.0×, 3=0.85×, 4=0.69×
- Community card height floor: 50pt
- Hand area: 2 rows × 8 cards = 180pt locked
- Player slots always visible as dashed gold placeholders

## Card.tsx rendering branches

THREE branches exist:
1. faceDown
2. **V2 Minimalist (lines ~350-360) — ACTIVE in production**
3. Classic (lines ~365-391) — DEAD CODE, edits do nothing

When changing card visuals, always check `card_layout` config first. If `'v2'`, edit V2 branch only.

## Build numbers (TWO in parallel)

- `build_history.build_number` — DB internal (e.g. 370)
- EAS internal CFBundleVersion (e.g. 452) — separate counter
- Apple TestFlight display number — what user sees, varies

When user says "b370" they mean DB internal. Always reference both numbers in commit messages and DB notes.

## CI pipeline awareness

`ios-testflight.yml` has 23 steps × ~7 transient failure points. Multi-failures per build are NORMAL.

Common transient failures (rerun, don't fix code):
- yarn install DNS (`registry.yarnpkg.com` ENOTFOUND)
- Cache restore "responded with 400"
- xcodebuild `-exportArchive` "request timed out"
- Apple Portal "No profiles for com.capspoker.app were found"

If `Build & archive` succeeds but later step fails → it's NOT code. Rerun via `gh run rerun <id>` or `github-debug?action=rerun`.

## Workflow for code changes

```bash
# 1. Branch
git checkout main && git pull
git checkout -b fix/auto-b<NNN>-<topic>

# 2. Edit files (use str_replace, not full rewrites)

# 3. Verify
./node_modules/.bin/tsc --noEmit
# if eslint exists:
./node_modules/.bin/eslint . --ext .ts,.tsx --max-warnings=0

# 4. Commit (atomic, descriptive)
git add -A
git status   # verify only expected files
git commit -m "fix(<scope>): <what>

<why + how>

Targets b<NNN>. Resolves <issue refs>."

# 5. Push + PR
git push -u origin fix/auto-b<NNN>-<topic>
gh pr create --title "fix(b<NNN>): <topic>" --body "..."
gh pr merge --squash --auto
```

## DB row insert protocol

After squash-merge appears on main:

```sql
-- Get NEW workflow run ID first
-- (workflow auto-triggers on push to main)
INSERT INTO build_history
  (build_number, version, platform, profile, status, eas_build_id, git_branch, started_at, notes)
VALUES
  (<NNN>, '2.7.0', 'ios', 'production', 'in_progress', '<RUN_ID>', 'main', NOW(),
   '<one-paragraph: what changed, why, what to verify>')
RETURNING id;
```

Leave `status='in_progress'` until user visually confirms in TestFlight. Only then flip to `live`.

## Files you'll commonly touch

| File | Purpose |
|---|---|
| `app/game.tsx` | Game screen + card scale ladder |
| `components/BoardArrangement.tsx` | Board container layout |
| `components/Board.tsx` | Single board (community + slots + chip + label) |
| `components/Card.tsx` | Card visual (V2 = active branch) |
| `components/PlayerHand.tsx` | 2-row 8+8 hand layout |
| `app.json` | Channel config (`updates.requestHeaders.expo-channel-name`) |
| `.github/workflows/ios-testflight.yml` | CI pipeline (do NOT casually edit) |

## Stop conditions

Halt to `/tmp/HALT_<reason>.md` if:
- TypeScript fails after 2 fix attempts
- Branch state can't be recovered
- Drag/drop in hand breaks after restructure
- Layout assumption (stacked-only) being violated
- CI fails 2× for same non-transient reason

## Final report format (for handoff back to Claude/Roye)

```
## EXEC RESULT
- Branch: fix/auto-b<NNN>-<topic>
- Commit SHA: <sha>
- PR URL: <url>
- Squash-merge SHA on main: <sha>
- CI run_id: <id>, conclusion: <success|failure|in_progress>
- DB build_history.id: <n>
- Files modified: [list with line counts +/-]
- TypeScript: PASS / FAIL details
- Hook bypass: <none | --no-verify reason>
- Halt files: <none | path>
- Open questions for Roye: [list]
```

## When in doubt

- Read this file again
- Check `userMemories` (Claude has these in chat context)
- Query `session_handoffs.id=1` for last session's state
- ASK Roye one specific question — don't guess
