VAMOS CAPS WHATSAPP-MULTIPROJECT v1.9.3-b96 2026-03-19-2100

## Current state: v1.9.3 build #96 | commit eb7620c
Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## GOAL
Make the WhatsApp bot work for ALL projects — not just Caps Poker.
When user sends a message, bot detects which project and routes the fix to the correct repo.

---

## TASK A — Update Edge Function with project routing
Agent: routing-agent

A1. Read supabase/functions/whatsapp-bot-handler/index.ts in full

A2. Add project detection map at the top:
    ```typescript
    const REPO_MAP: Record<string, string> = {
      'caps-poker':          'royea-beep/caps-poker',
      'wingman':             'royea-beep/wingman',
      'keydrop':             'royea-beep/KeyDrop',
      'analyzer':            'royea-beep/analyzer-standalone',
      'explainit':           'royea-beep/ExplainIt',
      'postpilot':           'royea-beep/PostPilot',
      'ftable':              'royea-beep/ftable',
      'letsmakebillions':    'royea-beep/letsmakebillions',
    };

    const PROJECT_KEYWORDS: Record<string, string[]> = {
      'caps-poker':       ['caps', 'poker', 'קלפים', 'קפס', 'בורד', 'board', 'omaha'],
      'wingman':          ['wingman', 'ווינגמן', 'שידוך', 'dating', 'מינגמן'],
      'keydrop':          ['keydrop', 'key drop', 'מפתח', 'קיידרופ', 'credentials'],
      'analyzer':         ['analyzer', 'אנלייזר', 'מנתח', 'analyse', 'analyze', 'product'],
      'explainit':        ['explainit', 'explain', 'הסבר', 'אקספליין', 'video', 'וידאו'],
      'postpilot':        ['postpilot', 'post pilot', 'פוסט', 'social', 'scheduler'],
      'ftable':           ['ftable', 'פנטזי', 'fantasy', 'football', 'שולחן'],
      'letsmakebillions': ['billions', 'ביליונים', 'crypto', 'קריפטו', 'trading', 'whale'],
    };

    function detectProject(text: string): string {
      const lower = text.toLowerCase();
      for (const [project, keywords] of Object.entries(PROJECT_KEYWORDS)) {
        if (keywords.some(kw => lower.includes(kw))) return project;
      }
      return 'caps-poker'; // default
    }
    ```

A3. Update triggerGitHubAction to use detected project repo:
    ```typescript
    async function triggerGitHubAction(plan: ClaudePlan, project: string): Promise<void> {
      const repo = REPO_MAP[project] ?? REPO_MAP['caps-poker'];
      await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          event_type: 'claude-fix',
          client_payload: {
            summary: plan.summary,
            plan: plan.plan.join('\n'),
            files: plan.files.join(', '),
            effort: plan.effort,
            type: plan.type,
            project,
          },
        }),
      });
    }
    ```

A4. Add project to ClaudePlan interface:
    ```typescript
    interface ClaudePlan {
      type: 'BUG' | 'FEATURE' | 'QUESTION';
      summary: string;
      plan: string[];
      files: string[];
      effort: 'LOW' | 'MEDIUM' | 'HIGH';
      project?: string;
    }
    ```

A5. Update generatePlan system prompt to include project context:
    ```typescript
    const project = detectProject(input);
    const projectStacks: Record<string, string> = {
      'caps-poker':       'React Native + Expo SDK 55, Omaha poker game',
      'wingman':          'Next.js + Supabase, social matchmaking app',
      'keydrop':          'Next.js + Prisma + Neon, encrypted one-time credential links',
      'analyzer':         'Next.js + Claude Vision + LemonSqueezy, product analyzer',
      'explainit':        'Next.js + Playwright, explainer video generator',
      'postpilot':        'Next.js + Prisma, social media post scheduler',
      'ftable':           'Vanilla JS, fantasy football table game',
      'letsmakebillions': 'Python + Railway, crypto trading bot',
    };
    const stack = projectStacks[project] ?? projectStacks['caps-poker'];
    
    // In system prompt:
    `You are a dev assistant for the project: ${project} (${stack}).
     Analyze this bug report or feature request.
     CRITICAL: Respond ONLY in Hebrew.
     ...`
    ```

A6. Store project in session + pass to triggerGitHubAction:
    In the main handler, after detectProject:
    ```typescript
    const project = detectProject(inputText);
    const plan = await generatePlan(inputText, project);
    // ...
    await triggerGitHubAction(plan, project);
    ```

A7. Add project name to reply message:
    ```typescript
    // In formatPlanReply, add project line:
    return `${typeEmoji} סוג: ${typeHe} | פרויקט: ${project ?? 'caps-poker'}
    ...`
    ```

A8. Deploy:
    cd /c/Projects/Caps && npx supabase link --project-ref gxrpunvhjcrzqnitbqah
    npx supabase functions deploy whatsapp-bot-handler --no-verify-jwt

---

## TASK B — Add claude-fix.yml to all other repos
Agent: ci-deploy-agent

B1. Read .github/workflows/claude-fix.yml from caps-poker

B2. Check which repos already have it:
    for repo in wingman KeyDrop analyzer-standalone ExplainIt PostPilot ftable letsmakebillions; do
      result=$(gh api repos/royea-beep/$repo/contents/.github/workflows/claude-fix.yml 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print('exists')" 2>/dev/null || echo "missing")
      echo "$repo: $result"
    done

B3. For each repo that is MISSING claude-fix.yml:
    - Read the file content from caps-poker
    - Push it to the missing repo via GitHub API
    - Use gh api to create the file

B4. Set ANTHROPIC_API_KEY on each repo that needs it:
    AKEY=$(grep ANTHROPIC_API_KEY /c/Projects/analyzer-standalone/.env.local | head -1 | cut -d= -f2-)
    for repo in wingman KeyDrop analyzer-standalone ExplainIt PostPilot; do
      gh secret set ANTHROPIC_API_KEY --repo royea-beep/$repo --body "$AKEY" 2>/dev/null && echo "$repo ✅" || echo "$repo ❌"
    done

B5. Set VERCEL_TOKEN + TWILIO secrets on repos that need web deploy:
    - Check which repos have Vercel deployments
    - Set secrets accordingly

B6. Report: which repos now have claude-fix.yml + ANTHROPIC_API_KEY

---

## FINAL STEPS
1. git add -A && git commit -m "feat: WhatsApp bot multi-project routing + claude-fix.yml all repos [v1.9.3-b97]"
2. git push origin main
3. Update MEMORY.md
4. Report summary table

VAMOS CAPS WHATSAPP-MULTIPROJECT — END
