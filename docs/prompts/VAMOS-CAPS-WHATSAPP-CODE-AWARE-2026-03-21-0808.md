# VAMOS CAPS WHATSAPP-CODE-AWARE
**Date:** 2026-03-21 08:08 IST
**Priority:** 🔴 Bot generates wrong plans — must read code first

## ROLE
Senior backend engineer

## FIRST ACTIONS
```
Read C:\Projects\Caps\MEMORY.md
cat C:\Projects\Caps\supabase\functions\whatsapp-bot-handler\index.ts
```

## CONTEXT
Problem: When a user reports a bug, Claude Haiku generates a fix plan WITHOUT reading the actual codebase. It guesses what files exist and what they do. This leads to wrong plans (e.g., suggesting to fix audio files when the feature is text-only).

Solution: Before generating a plan, the bot should fetch relevant files from GitHub and include them in the Claude context. The bot already has GITHUB_TOKEN.

## MISSION

═══════════════════════════════════════════════
AGENT 1 — Create Project Manifest
═══════════════════════════════════════════════

Create `docs/PROJECT_MANIFEST.md` in the Caps repo:

```markdown
# CAPS POKER — Project Manifest
**For AI agents — read this before generating any plan**

## Feature Map
| Feature | Files | Notes |
|---------|-------|-------|
| Card display | components/Card.tsx | White bg, suit glow, suit border |
| Board layout | components/Board.tsx | Color-coded borders (gold/blue/green/orange) |
| Player hand | components/PlayerHand.tsx | 1.3x larger than board cards |
| Game logic | app/game.tsx, utils/gameLogic.ts | Tap-to-place, timer, phases |
| Reveal sequence | hooks/useRevealSequence.ts | Board-by-board turn+river |
| COMPLETE bonus | components/CompleteOverlay.tsx | Flash + 40 particles + gold pulse + haptics |
| Pro Quotes | components/ProQuoteBanner.tsx, constants/proQuotes.ts | TEXT ONLY — NO AUDIO. AI simulation quotes from poker pros. Disclaimer on every display. |
| Tutorial | components/Tutorial.tsx | 4-step overlay, first launch only |
| In-game hints | app/game.tsx (HINT_TEXTS) | First 3 games only, AsyncStorage counter |
| Sound system | utils/sounds.ts | Card place, win, lose, complete sounds |
| Settings | app/settings.tsx | Themes, pro quotes toggle, tutorial reset |
| Single player | app/game.tsx | vs random bot |
| Local MP | utils/gameServer.ts, gameClient.ts | react-native-tcp-socket |
| Internet MP | utils/realtimeMultiplayer.ts | Supabase Realtime |
| Leaderboard | Supabase table | Global scores |
| Hand history | app/hand-history.tsx | Past hands viewer |
| Economy | utils/economy.ts, constants/economyConfig.ts | Chips, match costs |
| Auth | utils/auth.ts | Google OAuth |

## What Does NOT Exist
- Pro Quotes have NO audio/sound files — they are text-only by design
- No drag-and-drop — tap only (Iron Rule)
- No backend server — all local + Supabase
- No chat between players (not yet)
- No tournament mode (not yet)

## Iron Rules (NEVER violate)
1. React Native + Expo only
2. iOS portrait only
3. All params runtime-configurable
4. Full Omaha evaluation (2 player + 3 board)
5. Bot = random only
6. No backend — AsyncStorage
7. Local MP via react-native-tcp-socket
8. Internet MP via Supabase Realtime
```

Commit this file.

═══════════════════════════════════════════════
AGENT 2 — Upgrade Edge Function: Fetch Manifest
═══════════════════════════════════════════════

Update `supabase/functions/whatsapp-bot-handler/index.ts`:

**A. Add GitHub file fetcher:**

```typescript
async function fetchFileFromGitHub(repo: string, path: string): Promise<string | null> {
  try {
    const token = Deno.env.get('GITHUB_TOKEN');
    const res = await fetch(
      `https://api.github.com/repos/${repo}/contents/${path}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3.raw',
        },
      }
    );
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}
```

**B. Before calling Claude for plan generation:**

1. Fetch the project manifest:
```typescript
const manifest = await fetchFileFromGitHub(
  repoFullName, // e.g. 'royea-beep/caps-poker'
  'docs/PROJECT_MANIFEST.md'
);
```

2. Based on keywords in the user's message, also fetch 1-3 relevant source files:
```typescript
// Simple keyword → file mapping
const KEYWORD_FILES: Record<string, string[]> = {
  'קלף': ['components/Card.tsx'],
  'card': ['components/Card.tsx'],
  'בורד': ['components/Board.tsx'],
  'board': ['components/Board.tsx'],
  'סאונד': ['utils/sounds.ts'],
  'sound': ['utils/sounds.ts'],
  'audio': ['utils/sounds.ts'],
  'quote': ['components/ProQuoteBanner.tsx', 'constants/proQuotes.ts'],
  'ציטוט': ['components/ProQuoteBanner.tsx', 'constants/proQuotes.ts'],
  'משפט': ['components/ProQuoteBanner.tsx', 'constants/proQuotes.ts'],
  'שחקן': ['components/ProQuoteBanner.tsx'],
  'complete': ['components/CompleteOverlay.tsx'],
  'reveal': ['hooks/useRevealSequence.ts'],
  'timer': ['app/game.tsx'],
  'tutorial': ['components/Tutorial.tsx'],
  'setting': ['app/settings.tsx'],
  'הגדר': ['app/settings.tsx'],
  'multiplayer': ['utils/realtimeMultiplayer.ts'],
  'lobby': ['app/lobby/host.tsx', 'app/lobby/internet-join.tsx'],
  'leaderboard': ['app/leaderboard.tsx'],
  'chip': ['components/ChipsDisplay.tsx', 'utils/economy.ts'],
  "צ'יפ": ['components/ChipsDisplay.tsx', 'utils/economy.ts'],
};

function getRelevantFiles(message: string): string[] {
  const files = new Set<string>();
  const lower = message.toLowerCase();
  for (const [keyword, paths] of Object.entries(KEYWORD_FILES)) {
    if (lower.includes(keyword)) {
      paths.forEach(p => files.add(p));
    }
  }
  // Max 3 files to stay within token limits
  return Array.from(files).slice(0, 3);
}
```

3. Fetch the relevant files:
```typescript
const relevantPaths = getRelevantFiles(userMessage);
const relevantFiles: string[] = [];
for (const path of relevantPaths) {
  const content = await fetchFileFromGitHub(repoFullName, path);
  if (content) {
    // Truncate to first 200 lines to stay within token budget
    const truncated = content.split('\n').slice(0, 200).join('\n');
    relevantFiles.push(`\n--- FILE: ${path} ---\n${truncated}`);
  }
}
```

**C. Update the system prompt:**

```typescript
const systemPrompt = `You are a dev assistant for the project: ${project} (${stack}).

PROJECT MANIFEST (source of truth — trust this over assumptions):
${manifest || 'Not available'}

RELEVANT SOURCE FILES (actual code from the repo):
${relevantFiles.join('\n') || 'No relevant files fetched'}

RULES:
- Base your plan ONLY on what you see in the manifest and source files above
- If a feature is described as "text only" in the manifest, do NOT suggest audio fixes
- If you can't find evidence of something in the code, say so
- Do NOT assume files or features exist — check the manifest first

Analyze this bug report or feature request.
CRITICAL: Respond ONLY in Hebrew. All text must be in Hebrew.

FORMAT:
TYPE: bug / feature / refactor
SEVERITY: CRITICAL (crashes/breaks gameplay) / MEDIUM (UX/visual) / LOW (polish/nice-to-have)
SUMMARY: one line
PLAN: numbered steps (based on ACTUAL code you see above)
FILES: comma-separated list of files to change
EFFORT: low / medium / high`;
```

═══════════════════════════════════════════════
AGENT 3 — Deploy + Test
═══════════════════════════════════════════════

```
cd C:\Projects\Caps
npx supabase functions deploy whatsapp-bot-handler --no-verify-jwt
```

Verify alive:
```
curl -s -o /dev/null -w "%{http_code}" https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler
```

═══════════════════════════════════════════════
AGENT 4 — Finish
═══════════════════════════════════════════════

```
F1. npx tsc --noEmit — 0 errors
F2. npx jest --forceExit — 126+ pass
F3. git add -A && git commit -m "feat: WhatsApp bot reads code before generating plan — manifest + GitHub file fetch"
F4. git push origin main
F5. Update MEMORY.md
```

## SUCCESS CRITERIA
- ✅ docs/PROJECT_MANIFEST.md exists in repo
- ✅ Edge Function fetches manifest before every plan
- ✅ Edge Function fetches 1-3 relevant source files based on keywords
- ✅ System prompt includes actual code context
- ✅ If someone reports "pro quotes sound doesn't work" → bot sees ProQuoteBanner is text-only → plan says "this is text only by design, no audio to fix"
- ✅ Function deployed, alive (405)
- ✅ All tests pass, 0 TS errors

## DO NOT
- Do NOT change game code
- Do NOT trigger a build
- Do NOT touch Twilio webhook

VAMOS CAPS WHATSAPP-CODE-AWARE — END
