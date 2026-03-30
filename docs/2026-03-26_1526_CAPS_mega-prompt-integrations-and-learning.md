VAMOS — Fix all bugs, integrate 5 systems, build Learning System. No clarifying questions.

## CONTEXT
- **Target project:** `C:\Projects\9soccer-mascots`
- **Live URL:** `https://ninesoccer-mascots.vercel.app`
- **All projects root:** `C:\Projects\`
- **Known locations to scan:**
  - `C:\Projects\_SHARED` — gems library
  - `C:\Projects\caps-poker` or `C:\Projects\Caps` or similar — Bug Reporter latest
  - `C:\Projects\90soccer` — parent project
  - `C:\Projects\Wingman` — SecretSauce v2, social features
  - `C:\Projects\PostPilot` or `C:\Projects\postpilot` — social media scheduling
  - `C:\Projects\TokenWise` or `C:\Projects\tokenwise` — token management
  - `C:\Projects\ZPROJECTMANAGER` or similar — Learning System reference
  - Any other project folder in `C:\Projects\`

---

## PHASE 0: FIND EVERYTHING FIRST

Before any code changes — locate ALL source material.

```bash
# List ALL projects
ls "C:\Projects\"

# Find SecretSauce in all projects
find "C:\Projects" -maxdepth 3 -name "*secretsauce*" -o -name "*SecretSauce*" -o -name "*secret_sauce*" 2>/dev/null

# Find TokenWise
find "C:\Projects" -maxdepth 3 -name "*tokenwise*" -o -name "*TokenWise*" -o -name "*token-wise*" 2>/dev/null
ls "C:\Projects\TokenWise" 2>/dev/null || ls "C:\Projects\tokenwise" 2>/dev/null

# Find PostPilot
find "C:\Projects" -maxdepth 3 -name "*postpilot*" -o -name "*PostPilot*" -o -name "*post-pilot*" 2>/dev/null
ls "C:\Projects\PostPilot" 2>/dev/null || ls "C:\Projects\postpilot" 2>/dev/null

# Find Bug Reporter — latest version from Caps
find "C:\Projects" -maxdepth 4 -name "*BugReport*" -o -name "*bug-report*" -o -name "*bugReport*" 2>/dev/null

# Find ZPROJECTMANAGER
find "C:\Projects" -maxdepth 3 -name "*ZPROJECT*" -o -name "*zproject*" -o -name "*projectmanager*" 2>/dev/null
# Also check Claude memory/sessions
find "C:\Users\royea\.claude" -name "*ZPROJECT*" -o -name "*learning*" 2>/dev/null

# Find Learning System references
find "C:\Projects" -maxdepth 4 -name "*learning*" -o -name "*Learning*" 2>/dev/null
grep -rl "learning_events\|learning.system\|learningSystem" "C:\Projects\9soccer-mascots\src" 2>/dev/null
grep -rl "learning" "C:\Projects\_SHARED" 2>/dev/null
```

**READ the CLAUDE.md of every project that exists:**
```bash
for dir in "C:\Projects"\*/; do
  if [ -f "$dir/CLAUDE.md" ]; then
    echo "=== $(basename $dir) ==="
    cat "$dir/CLAUDE.md"
    echo ""
  fi
done
```

**Also check for MEMORY.md files (session context):**
```bash
find "C:\Projects" -maxdepth 3 -name "MEMORY.md" 2>/dev/null
find "C:\Users\royea\.claude" -name "*.md" 2>/dev/null | head -20
```

Report what you found for each system before proceeding.

---

## PHASE 1: FIX ALL BUGS

### 1a. Fix the 1 failing test (World Cup Hub flow)
- Read the failing test
- Read WorldCupHub.tsx
- Fix whatever selector or timing issue causes the failure
- Run tests — target 115/115

### 1b. Scan for all warnings/issues
```bash
cd C:\Projects\9soccer-mascots
npm run build 2>&1 | grep -i "warn\|error"
npx tsc --noEmit 2>&1 | head -50
```

Fix any TypeScript warnings, unused imports, missing types.

### 1c. Console errors on live site
Run Playwright, capture console:
```typescript
page.on('console', msg => { if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text()) })
```
Fix any runtime errors found.

### 1d. Check all API endpoints
```bash
curl -s https://ninesoccer-mascots.vercel.app/api/scorebat/highlights | head -100
curl -s https://ninesoccer-mascots.vercel.app/api/scorebat/competitions | head -100
curl -s -X POST https://ninesoccer-mascots.vercel.app/api/bookings -H "Content-Type: application/json" -d '{"familyId":"test","packageName":"test","packagePrice":0}'
curl -s https://ninesoccer-mascots.vercel.app/api/vision-trivia 2>/dev/null
```
Fix any that return errors.

---

## PHASE 2: INTEGRATE SECRETSAUCE (latest version)

### Find the latest version:
```bash
# Check what 9soccer currently has
cat "C:\Projects\9soccer-mascots\src\lib\secretSauce.ts"

# Find all versions across projects
find "C:\Projects" -maxdepth 4 -name "*secretSauce*" -o -name "*secret-sauce*" 2>/dev/null
```

### For each version found — READ IT and compare:
- Which has the richest event metadata?
- Which has micro-batching?
- Which has error tracking?
- Which has page/screen tracking?
- Which has session management?
- Which has offline queue?

### Take the BEST version and make it 9soccer's:
- Merge all the best features into one file
- Keep the same `trackEvent()` signature (zero breaking changes)
- Add any missing features:
  - Event deduplication
  - Retry on Supabase failure
  - Offline queue with IndexedDB
  - Session recording (screen path)
  - Performance metrics auto-tracking
- Wire into all components that emit events

---

## PHASE 3: INTEGRATE TOKENWISE

### Read TokenWise project:
```bash
cat "C:\Projects\TokenWise\CLAUDE.md" 2>/dev/null || cat "C:\Projects\tokenwise\CLAUDE.md" 2>/dev/null
cat "C:\Projects\TokenWise\package.json" 2>/dev/null || cat "C:\Projects\tokenwise\package.json" 2>/dev/null
find "C:\Projects\TokenWise\src" -name "*.ts" -o -name "*.tsx" 2>/dev/null | sort
find "C:\Projects\tokenwise\src" -name "*.ts" -o -name "*.tsx" 2>/dev/null | sort
```

### Understand what TokenWise does:
- Token/credit management? API cost tracking? Usage limits?
- Read EVERY source file to understand

### Integrate into 9soccer:
- If it tracks API costs → wire to ScoreBat calls, ElevenLabs calls, Claude Vision calls, HeyGen calls, fal.ai calls
- If it manages user credits/tokens → wire to the premium/IAP system (future RevenueCat)
- If it monitors usage → add to admin dashboard
- Create `src/services/tokenwise.ts` or integrate into existing cost tracking

---

## PHASE 4: INTEGRATE POSTPILOT

### Read PostPilot project:
```bash
cat "C:\Projects\PostPilot\CLAUDE.md" 2>/dev/null || cat "C:\Projects\postpilot\CLAUDE.md" 2>/dev/null
cat "C:\Projects\PostPilot\package.json" 2>/dev/null
find "C:\Projects\PostPilot\src" -name "*.ts" -o -name "*.tsx" 2>/dev/null | sort
```

### Understand what PostPilot does:
- Social media scheduling? Content generation? Post management?
- Read key source files

### Integrate into 9soccer:
- If it has social sharing patterns → enhance WorldCupHub sharing + GameRecap sharing
- If it generates content → auto-generate share text for scores/achievements
- If it schedules posts → allow users to schedule a "brag post" after winning trivia
- If it has image/card generation → create shareable score cards

---

## PHASE 5: FIX BUG REPORTER (latest from Caps)

### Find the latest Bug Reporter:
```bash
# Current version in 9soccer
cat "C:\Projects\9soccer-mascots\src\components\BugReporter.tsx"

# Find Caps version
find "C:\Projects" -maxdepth 4 -path "*caps*" -name "*BugReport*" 2>/dev/null
find "C:\Projects" -maxdepth 4 -path "*Caps*" -name "*BugReport*" 2>/dev/null
# Read ALL versions
```

### Compare and identify what's broken:
- Read Caps version line by line
- Read 9soccer version line by line
- What's different? What's the bug?

### Common Bug Reporter issues:
- Console capture not working (console.log override timing)
- Screenshot capture failing (html2canvas or canvas issues)
- Supabase insert failing (table/column mismatch)
- 5-tap detection too sensitive or not sensitive enough
- Mobile touch events not properly handled
- Dialog overlay z-index conflicts
- Form submission not clearing state
- Network info capture failing

### Fix it completely:
- Take the Caps version as base (it's supposed to be the latest)
- Fix whatever is broken
- Test: trigger bug reporter → verify it captures console + localStorage + device info → verify Supabase insert works
- Make sure it works on both desktop and mobile

---

## PHASE 6: BUILD LEARNING SYSTEM

### Find ZPROJECTMANAGER reference:
```bash
# Search everywhere
find "C:\Projects" -maxdepth 5 -name "*ZPROJECT*" -o -name "*zproject*" 2>/dev/null
find "C:\Users\royea" -maxdepth 5 -name "*ZPROJECT*" 2>/dev/null
grep -rl "ZPROJECTMANAGER\|learning.system\|LearningSystem" "C:\Projects" --include="*.md" --include="*.ts" --include="*.tsx" 2>/dev/null
# Check Claude project files
find "C:\Users\royea\.claude" -type f -name "*.md" 2>/dev/null -exec grep -l "learning\|ZPROJECT" {} \;
```

### If found — read it and implement based on its design.
### If NOT found — build based on this spec:

### Learning System Purpose:
Track what kids/users enjoy most in the app so we can constantly improve their experience.

### Supabase table: `learning_insights`

```sql
CREATE TABLE IF NOT EXISTS learning_insights (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  family_id text NOT NULL,
  
  -- What they interacted with
  feature text NOT NULL,          -- 'static_trivia', 'video_trivia', 'worldcup_hub', 'packages', 'mascot_interaction', 'leaderboard', 'game_recap', 'video_reward'
  
  -- Engagement signals
  time_spent_seconds integer,     -- how long they stayed on this feature
  interactions_count integer,     -- taps, answers, scrolls
  completion_rate numeric,        -- 0.0 to 1.0 (e.g., answered 8/10 questions = 0.8)
  
  -- Preferences
  preferred_mascot text,          -- which mascot was active most
  preferred_competition text,     -- which league they watch most (from ScoreBat)
  preferred_difficulty text,      -- 'easy', 'medium', 'hard' based on score patterns
  
  -- Satisfaction signals
  replay_count integer DEFAULT 0, -- how many times they replayed this feature
  shared boolean DEFAULT false,   -- did they share the result
  quit_early boolean DEFAULT false, -- did they quit before finishing
  
  -- Score patterns
  avg_score numeric,
  best_score numeric,
  score_trend text,               -- 'improving', 'stable', 'declining'
  
  -- Session context
  session_id text,
  device_type text,               -- 'mobile', 'tablet', 'desktop'
  language text                   -- 'he', 'en', 'ar', 'es'
);

CREATE INDEX idx_learning_family ON learning_insights(family_id);
CREATE INDEX idx_learning_feature ON learning_insights(feature);
CREATE INDEX idx_learning_date ON learning_insights(created_at);

ALTER TABLE learning_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert" ON learning_insights FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role reads" ON learning_insights FOR SELECT USING (auth.role() = 'service_role');
```

### Create `src/services/learningSystem.ts`:

```typescript
export const learningSystem = {
  // Track feature engagement
  trackEngagement(data: EngagementData): void
  
  // Analyze user preferences (runs client-side from cached data)
  getInsights(familyId: string): Promise<LearningInsights>
  
  // Get personalized recommendations
  getRecommendations(familyId: string): Promise<Recommendation[]>
  
  // Auto-track: wraps around existing analytics
  startSession(familyId: string): SessionTracker
}
```

### SessionTracker class:
```typescript
class SessionTracker {
  private startTime: number
  private interactions: number
  private currentFeature: string
  
  enterFeature(feature: string): void    // start tracking time
  leaveFeature(): void                    // save time_spent + interactions
  recordInteraction(): void               // increment counter
  recordCompletion(rate: number): void    // save completion rate
  recordScore(score: number, total: number): void
  recordShare(): void
  recordQuitEarly(): void
  flush(): Promise<void>                  // save all pending to Supabase
}
```

### Wire into EVERY feature:

**App.tsx — on state change:**
```typescript
// When state changes, track feature transition
useEffect(() => {
  sessionTracker.leaveFeature()  // save previous
  sessionTracker.enterFeature(state)  // start new
}, [state])
```

**Trivia (static + dynamic):**
- Track: questions answered, score, time per question, quit early
- Track: preferred difficulty (based on score patterns)

**WorldCupHub:**
- Track: time spent, videos watched, tabs clicked, competitions browsed
- Track: preferred_competition (most clicked league)

**FloatingMascot:**
- Track: which mascot gets tapped most → preferred_mascot

**GameRecap + VideoRewards:**
- Track: shared or not, replay count

**Packages:**
- Track: which packages viewed most, CTA clicked

### Admin Dashboard — Learning Insights Section:
Add to admin panel (5-tap unlock):
- "📊 Learning Insights"
- Show: most popular feature, preferred mascot, avg session time
- Show: top competitions by engagement
- Show: score trend (improving/stable/declining)
- Show: quit rate per feature
- Show: share rate per feature

### Personalized Recommendations Engine:
Based on insights, generate recommendations:
```typescript
function getRecommendations(insights: LearningInsights): Recommendation[] {
  const recs: Recommendation[] = []
  
  // If they love video trivia more than static → suggest video trivia first
  if (insights.videoTriviaEngagement > insights.staticTriviaEngagement) {
    recs.push({ type: 'feature_highlight', feature: 'video_trivia', message: 'אהבת טריוויה וידאו? יש שאלות חדשות!' })
  }
  
  // If they prefer Premier League → show PL highlights first in hub
  if (insights.preferredCompetition === 'Premier League') {
    recs.push({ type: 'content_filter', feature: 'worldcup_hub', filter: 'premier' })
  }
  
  // If score trend is declining → suggest easier mode or tips
  if (insights.scoreTrend === 'declining') {
    recs.push({ type: 'encouragement', message: 'אל תוותר! הנה כמה טיפים...' })
  }
  
  // If they never tried a feature → suggest it
  if (!insights.triedFeatures.includes('worldcup_hub')) {
    recs.push({ type: 'discovery', feature: 'worldcup_hub', message: 'ראית כבר את ההיילייטס החדשים?' })
  }
  
  return recs
}
```

### FloatingMascot shows recommendations:
Wire recommendations into FloatingMascot speech bubble:
- Instead of random messages, show personalized recommendations
- "ראיתי שאתה אוהב פרמייר ליג! יש היילייטס חדשים 🏴"
- "הציון שלך השתפר! בוא ננסה טריוויה וידאו 🎬"

---

## PHASE 7: RUN ALL TESTS

After all integrations:
```bash
cd C:\Projects\9soccer-mascots
npm run build
npx playwright test
npx playwright test tests/full-simulation.spec.ts
```

Target: 115/115 + 10/10 simulation. Fix any regressions.

---

## PHASE 8: COMMIT AND REPORT

```bash
git add -A && git commit -m "feat: SecretSauce upgrade + TokenWise + PostPilot + BugReporter fix + Learning System"
git push origin master
```

### Create `INTEGRATION_STATUS.md`:
```markdown
# Integration Status Report

## SecretSauce
- Version: X → Y
- New features: [list]
- Files changed: [list]

## TokenWise
- What it does: [description]
- How it's integrated: [description]  
- Files: [list]

## PostPilot
- What it does: [description]
- How it's integrated: [description]
- Files: [list]

## Bug Reporter
- Was broken because: [reason]
- Fixed by: [what changed]
- Now captures: [list]
- Tested: YES/NO

## Learning System
- Tables created: learning_insights
- Service: src/services/learningSystem.ts
- Wired into: [list of components]
- Admin section: YES/NO
- Recommendations engine: YES/NO

## Tests
- Before: X/Y
- After: X/Y
- New tests added: [count]
```

## DO NOT
- Skip any of the 6 phases
- Integrate something without understanding what it does first
- Break existing features
- Modify the design system
- Add external dependencies without checking project compatibility
- Guess what a system does — READ THE CODE
- Report "not found" without exhaustively searching — check ALL of C:\Projects\, C:\Users\royea\.claude\, and any path referenced in CLAUDE.md files
