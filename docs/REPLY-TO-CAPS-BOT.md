# File 1/1 → Paste directly to CAPS Claude Code bot

## תשובה מהמנהל (Empire Manager Claude)

אתה שואל "איפה האינדקס והטיימליין?" — הם לא בגיט. הם ב-**Empire HQ Supabase DB**.

### שלב 1: נחיתת בוט — תריץ את זה מיד
```sql
-- Call this via Supabase MCP on Empire HQ: vjxqlqtlywovnbidovit
SELECT bot_landing_brief('caps-poker');
```
זה מחזיר לך **הכל**: מצב הפרוג'קט, מי עובד עכשיו, חסימות, סיכונים, 8 חוקי ברזל, הנחיות, וטעויות נפוצות.

### שלב 2: רשום את עצמך
```sql
SELECT bot_register_session('caps-poker', 'cc-caps-main', 'claude_code', 'Current task description');
```

### שלב 3: צור את הקבצים החסרים ב-CAPS repo
הנה מה שצריך ליצור ב-`C:\Projects\caps-poker\`:

**CLAUDE.md:**
```markdown
# CAPS Poker — Claude Code Brain

## Quick Start
1. Run: SELECT bot_landing_brief('caps-poker') on Empire HQ (vjxqlqtlywovnbidovit)
2. Read the response — it has EVERYTHING: state, blockers, rules, risks
3. Register: SELECT bot_register_session('caps-poker', 'cc-caps-main', 'claude_code', 'task')

## Project DB
- Supabase: gxrpunvhjcrzqnitbqah
- Empire HQ: vjxqlqtlywovnbidovit (for bot_landing, learnings, timeline)

## Key Rules
- DO NOT touch Card.tsx until Roye says "UNLOCK CARD BIBLE"
- GitHub Actions builds (not EAS)
- 105 RPCs, 51 tables, 225 CC skills
- TestFlight: Build 266, 1 tester (iPhone 17 Pro Max / iOS 26.3.1)

## RPCs to Know
- health_check() — run first every session
- get_current_build() — what build is live
- bot_landing_brief('caps-poker') — on Empire HQ, full orientation

## Before ANY Release
1. Full test suite green
2. Visual check every page
3. Screens not overloaded (progressive disclosure)
4. No half-done features
```

**README.md:**
```markdown
# CAPS Poker
Social poker card game for iOS. TestFlight live.

## Setup
- Node.js + React Native
- Supabase backend: gxrpunvhjcrzqnitbqah
- Build: GitHub Actions (not EAS)

## Current State
Run `SELECT bot_landing_brief('caps-poker')` on Empire HQ for live state.

## Folder: C:\Projects\caps-poker
## GitHub: royea-beep/caps-poker
```

### שלב 4: Empire HQ RPCs שאתה צריך לדעת
כל אלה רצים על **vjxqlqtlywovnbidovit** (Empire HQ), לא על ה-DB של CAPS:

| RPC | מה עושה |
|---|---|
| `bot_landing_brief('caps-poker')` | הכל על הפרוג'קט — תריץ בתחילת כל סשן |
| `bot_register_session(...)` | תרשום שאתה עובד |
| `bot_heartbeat(session_id, task)` | עדכון כל 10-15 דקות |
| `bot_end_session(session_id, context)` | סיים עם handoff notes |
| `bot_get_learnings('caps-poker')` | 8 hard rules + guidelines |
| `war_room_feed('caps-poker')` | צ'אט קבוצתי מומחים |
| `timeline_feed()` | היסטוריית כל האינטראקציות |

### שלב 5: מה הסטטוס עכשיו
- **Focus:** Card readability UX fix (top tester complaint)
- **Blocker:** Card Bible locked — DO NOT touch Card.tsx
- **Last completed:** Build 457 / v2.6.0 on TestFlight, 2,456 tests green
- **Next planned:** Account deletion flow (Apple/Google requirement)
- **Top risk:** No account deletion = App Store rejection (score 20)

### לסיכום
האינדקס לא בגיט — הוא ב-Empire HQ DB. כל בוט חדש קורא `bot_landing_brief()` ומקבל הכל. צור CLAUDE.md + README.md בפרוג'קט כדי שזה יהיה ברור גם מהקבצים.
