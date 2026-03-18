# WhatsApp Bot Setup — Manual Steps
## Caps Poker | v1.9.3

---

## Step 1: Twilio Sandbox (5 min)

1. Go to [twilio.com](https://twilio.com) → sign up (free account)
2. Console → Messaging → Try it out → Send a WhatsApp message
3. Send `join [sandbox-word]` from your WhatsApp (+972504141513) to **+1 415 523 8886**
4. Copy your **Account SID** + **Auth Token** from the Twilio Console dashboard

---

## Step 2: Set Edge Function env vars

Run these in the Caps repo root after `supabase login`:

```bash
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
supabase secrets set TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
supabase secrets set TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxx
supabase secrets set OPENAI_API_KEY=sk-xxx
supabase secrets set GITHUB_TOKEN=ghp_xxx
```

**GITHUB_TOKEN** — create at https://github.com/settings/tokens → classic token → `repo` scope

---

## Step 3: Apply the migration

```bash
supabase db push
```

This creates the `whatsapp_sessions` table.

---

## Step 4: Deploy the Edge Function

```bash
supabase functions deploy whatsapp-bot-handler --no-verify-jwt
```

The function URL will be:
```
https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler
```

---

## Step 5: Set Twilio webhook URL

1. Twilio Console → Messaging → Settings → WhatsApp Sandbox Settings
2. **When a message comes in** → set to:
   ```
   https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler
   ```
   Method: **HTTP POST**
3. Save

---

## Step 6: Add ANTHROPIC_API_KEY to GitHub Secrets

```bash
gh secret set ANTHROPIC_API_KEY --repo royea-beep/caps-poker
```

(Paste the key when prompted)

---

## Step 7: Test end-to-end

1. Send a WhatsApp message to **+1 415 523 8886**:
   ```
   test bug: cards not showing after river flip
   ```
2. Bot should reply within ~5 seconds with a plan + APPROVE/CANCEL prompt
3. Reply `APPROVE` — should trigger GitHub Action → Claude commits a fix
4. Reply `CANCEL` — should reply "❌ Aborted. No changes made."

---

## How it works (summary)

```
You → WhatsApp → Twilio → Edge Function → Claude API → Reply with plan
You → APPROVE → Edge Function → GitHub repository_dispatch → claude-fix.yml → Claude Code → commit
```

## Message types supported

| Type | Handling |
|------|---------|
| Text | Passed directly to Claude |
| Voice note (.ogg) | Transcribed via OpenAI Whisper, then Claude |
| Image/screenshot | Described via Claude Vision, then Claude |

---

## Costs (10 bug reports/month)

| Service | Cost |
|---------|------|
| Twilio sandbox | Free |
| Claude Haiku | ~$0.03 |
| OpenAI Whisper (audio) | ~$0.06 |
| GitHub Actions | Free |
| **Total** | **~$0.10/month** |
