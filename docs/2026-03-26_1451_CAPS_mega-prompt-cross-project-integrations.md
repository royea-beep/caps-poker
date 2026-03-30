VAMOS — Deep scan ALL sibling projects. Find what 9soccer-mascots is missing. Actually integrate it. No clarifying questions.

## CONTEXT
- **Target project:** `C:\Projects\9soccer-mascots`
- **All projects root:** `C:\Projects\`
- **_SHARED:** `C:\Projects\_SHARED`
- **Known projects:** 90soccer, Wingman, caps-poker (Caps Poker), PostPilot, Analyzer, KeyDrop, ExplainIT

The GEMS extraction was supposed to find integrations from other projects. It wasn't thorough enough. This time — READ EVERY FILE, compare, and actually bring the good stuff into 9soccer-mascots.

## PHASE 1: DEEP SCAN EVERY PROJECT

For EACH project in `C:\Projects\`:

```bash
# List all projects
ls "C:\Projects\"
```

For each one that exists, do a FULL read:

```bash
# Read project overview
cat "C:\Projects\{project}\CLAUDE.md" 2>/dev/null
cat "C:\Projects\{project}\README.md" 2>/dev/null
cat "C:\Projects\{project}\package.json" 2>/dev/null

# List all source files
find "C:\Projects\{project}\src" -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" 2>/dev/null | sort

# Find utilities, services, helpers
find "C:\Projects\{project}\src" -type f -name "*util*" -o -name "*helper*" -o -name "*service*" -o -name "*hook*" -o -name "*shared*" -o -name "*common*" 2>/dev/null | sort

# Find patterns
find "C:\Projects\{project}" -name "*.md" -path "*pattern*" -o -name "*.md" -path "*gem*" -o -name "*.md" -path "*skill*" 2>/dev/null | sort

# Check for things 9soccer could use
find "C:\Projects\{project}\src" -type f \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null | head -50
```

**ACTUALLY READ the key files** — don't just list them. Open and read:
- Every service file
- Every utility file
- Every hook
- Every shared component
- Every pattern/gem/skill doc

## PHASE 2: COMPARE AND FIND GAPS

For each finding, ask: **"Does 9soccer-mascots have this? Is the version in the other project BETTER?"**

### Specific things to look for:

**From 90soccer (the full app):**
- Does it have a better ScoreBat integration than what we built?
- Better trivia engine?
- More polished components?
- Analytics patterns we're missing?
- Error handling we're missing?
- Offline mode?
- Any features 9soccer-mascots should have?

**From Wingman:**
- SecretSauce analytics — is their version better/newer?
- HeyGen pipeline — any improvements?
- i18n approach — better RTL handling?
- Social features (sharing, invites) — could 9soccer use?
- 78 screens — any UI patterns worth copying?
- Iron Rule 9 (zero free-text) — any input validation patterns?

**From Caps Poker:**
- Bug reporter pattern — do we have it in 9soccer?
- Supabase schema patterns — anything better?
- Expo/React Native patterns that translate to web?
- Game mechanics (turns, scoring) — any patterns for trivia?

**From PostPilot:**
- Social media integration — scheduling, posting
- Content generation patterns
- API management patterns

**From Analyzer:**
- Claude Vision integration — 9soccer planned this (idea #2 in audit)
- Image analysis patterns
- Product analysis → could become "player analysis"?

**From KeyDrop:**
- Encryption patterns
- Secure sharing patterns
- TestFlight workflow — the audit says "same TestFlight workflow (working v1.2.0)"

**From ExplainIT:**
- URL explainer → could become "match explainer"?
- MP4 pipeline → could enhance GameRecap?
- Character pipeline — audit says "could use character pipeline"

**From _SHARED (current 26 gems):**
- Which gems is 9soccer NOT using but SHOULD?
- Are any gems outdated compared to what's in the projects?
- Missing gems that should exist based on patterns found?

## PHASE 3: ACTUALLY INTEGRATE

Don't just report — DO IT. For each useful finding:

### Priority 1 — Direct code integration:
If another project has something 9soccer needs and it's compatible:
1. Copy the file
2. Adapt imports/configs for 9soccer
3. Wire it into the app
4. Test it works

### Priority 2 — Pattern adoption:
If another project has a BETTER pattern:
1. Refactor 9soccer's version to match
2. Update _SHARED with the better version

### Priority 3 — New features from other projects:
If a feature in another project would add real value to 9soccer:
1. Build it using the other project's code as reference
2. Adapt to 9soccer's stack and design system

### Specific integrations to attempt:

**Bug Reporter (from Caps Poker):**
- Does 9soccer have a bug report button? If not — add it
- User shakes phone or taps hidden button → sends screenshot + console logs + device info to Supabase

**Claude Vision Trivia (from Analyzer + audit idea #2):**
- Analyzer has Claude Vision. 9soccer planned "image-based questions"
- Read Analyzer's Vision code
- Create a new trivia type: show a stadium/player image, ask "who/what is this?"
- Add to DynamicTrivia alongside ScoreBat video questions

**Better Analytics (from Wingman):**
- Compare Wingman's trackEvent with 9soccer's
- If Wingman's is richer (more metadata, better batching, error tracking) — upgrade 9soccer's

**Offline Mode (from KeyDrop or any PWA project):**
- 9soccer has a service worker but is it caching trivia questions for offline play?
- If any project has a better offline strategy — adopt it

**MP4 Enhancement (from ExplainIT):**
- ExplainIT has an MP4 pipeline
- Could it improve GameRecap quality or add transitions?

**Social Sharing (from Wingman):**
- Wingman is a social app — does it have better sharing patterns?
- Deep links, invite flows, share cards?
- Could 9soccer generate a share card image with score?

## PHASE 4: UPDATE _SHARED

After all integrations:
1. Extract any new reusable patterns to `_SHARED`
2. Update existing gems if 9soccer's version is now better
3. Create new skill docs for any new patterns

## PHASE 5: FULL REPORT

Create `CROSS_PROJECT_INTEGRATION_REPORT.md`:

```markdown
# Cross-Project Integration Report
## Date: March 26, 2026

## Projects Scanned
| Project | Files Scanned | Useful Findings |
|---------|--------------|-----------------|

## Integrations Done
| Source Project | What | How | Files Changed |
|---------------|------|-----|---------------|

## Integrations Skipped (and why)
| Source Project | What | Why Skipped |
|---------------|------|-------------|

## _SHARED Updates
| Gem | Action (new/updated/unchanged) | Reason |
|-----|-------------------------------|--------|

## Recommendations for Future Sessions
1. ...
2. ...
```

## AFTER

```bash
# Run tests to make sure nothing broke
npx playwright test

# Commit
git add -A && git commit -m "feat: cross-project integrations — bug reporter, vision trivia, enhanced analytics, offline cache"
git push origin master
```

## DO NOT
- Just list findings without integrating
- Copy code that breaks TypeScript strict mode
- Add dependencies without checking compatibility
- Change the design system
- Break existing 115 tests
- Skip any project — scan ALL of them
- Be lazy — READ the actual code, don't just list filenames
