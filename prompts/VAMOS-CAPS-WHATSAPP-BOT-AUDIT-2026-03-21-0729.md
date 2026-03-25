# VAMOS CAPS WHATSAPP-BOT-AUDIT
**Date:** 2026-03-21 07:29 IST
**Priority:** Understand what the bot DOES — not if it's alive

## ROLE
QA auditor — read the bot logic and report exactly what it does

## RULES
- DO NOT change any code
- DO NOT redeploy
- ONLY read and report

## STEP 1 — Read the Full Edge Function
```
cat C:\Projects\Caps\supabase\functions\whatsapp-bot-handler\index.ts
```

## STEP 2 — Read Any Related Files
```
ls C:\Projects\Caps\supabase\functions\whatsapp-bot-handler\
cat C:\Projects\Caps\supabase\functions\whatsapp-bot-handler\*.ts
```

Check for config, prompts, templates:
```
grep -rn "system\|prompt\|role\|message" C:\Projects\Caps\supabase\functions\whatsapp-bot-handler\
```

## STEP 3 — Read MEMORY.md for Bot Spec
```
grep -A 20 -i "whatsapp\|bot" C:\Projects\Caps\MEMORY.md
```

Also check docs:
```
cat C:\Projects\Caps\docs\GOTCHAS-AND-LESSONS.md 2>/dev/null
ls C:\Projects\Caps\docs\
```

## STEP 4 — Report

```
═══════════════════════════════════════
WHATSAPP BOT — LOGIC AUDIT
═══════════════════════════════════════

WHAT THE BOT DOES (step by step):
1. [receives message → does X]
2. [calls X API → does Y]
3. [responds with Z]

TRIGGER: [what kind of messages trigger it?]
AI MODEL: [which model? OpenAI / Anthropic / both?]
SYSTEM PROMPT: [print the FULL system prompt if exists]
RESPONSE FORMAT: [text only? rich? buttons?]

FEATURES:
- [list every feature the bot has]

LIMITATIONS:
- [what it CAN'T do]

SUPABASE TABLES USED:
- [list any DB reads/writes]

SECRETS USED:
- [list which env vars / secrets it reads]

FULL SOURCE CODE:
[print the entire index.ts — we need to see everything]

═══════════════════════════════════════
```

VAMOS CAPS WHATSAPP-BOT-AUDIT — END
