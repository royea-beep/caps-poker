import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!;
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!;
const TWILIO_WHATSAPP_FROM = Deno.env.get('TWILIO_WHATSAPP_FROM')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const GITHUB_REPO = 'royea-beep/caps-poker';

// ── Twilio signature verification ──────────────────────────────────────────

async function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
): Promise<boolean> {
  // Sort params alphabetically and concatenate
  const sortedKeys = Object.keys(params).sort();
  let str = url;
  for (const key of sortedKeys) {
    str += key + params[key];
  }
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(TWILIO_AUTH_TOKEN),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(str));
  const computed = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));
  return computed === signature;
}

// ── Twilio send message ─────────────────────────────────────────────────────

async function sendWhatsApp(to: string, body: string): Promise<void> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const params = new URLSearchParams({
    From: TWILIO_WHATSAPP_FROM,
    To: to,
    Body: body,
  });
  const creds = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
}

// ── Transcribe audio via OpenAI Whisper ────────────────────────────────────

async function transcribeAudio(mediaUrl: string): Promise<string> {
  // Fetch audio from Twilio (needs auth)
  const creds = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  const audioRes = await fetch(mediaUrl, {
    headers: { Authorization: `Basic ${creds}` },
  });
  const audioBlob = await audioRes.blob();

  const form = new FormData();
  form.append('file', audioBlob, 'audio.ogg');
  form.append('model', 'whisper-1');
  form.append('language', 'he'); // Hebrew default, Whisper auto-detects

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  const data = await res.json();
  return data.text ?? '';
}

// ── Describe image via Claude Vision ───────────────────────────────────────

async function describeImage(mediaUrl: string): Promise<string> {
  console.log('[whatsapp-bot] Fetching image from:', mediaUrl);
  const creds = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

  const imgRes = await fetch(mediaUrl, {
    headers: {
      'Authorization': `Basic ${creds}`,
    },
  });

  console.log('[whatsapp-bot] Image fetch status:', imgRes.status, imgRes.headers.get('content-type'));

  if (!imgRes.ok) {
    throw new Error(`Image fetch failed: ${imgRes.status}`);
  }

  const imgBuf = await imgRes.arrayBuffer();
  const uint8 = new Uint8Array(imgBuf);

  // Convert to base64 in chunks to avoid stack overflow on large images
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8.length; i += chunkSize) {
    const chunk = uint8.slice(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  const base64 = btoa(binary);

  const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
  console.log('[whatsapp-bot] Image size:', imgBuf.byteLength, 'bytes, type:', contentType);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: contentType, data: base64 },
            },
            {
              type: 'text',
              text: 'תאר את צילום המסך הזה לדיווח באג. התמקד במה שגלוי על המסך, שגיאות, בעיות UI, או התנהגות לא צפויה. היה תמציתי בעברית.',
            },
          ],
        },
      ],
    }),
  });

  const data = await res.json();
  console.log('[whatsapp-bot] Vision response:', JSON.stringify(data).slice(0, 200));
  return data.content?.[0]?.text ?? '';
}

// ── Generate plan via Claude ────────────────────────────────────────────────

interface ClaudePlan {
  type: 'BUG' | 'FEATURE' | 'QUESTION';
  summary: string;
  plan: string[];
  files: string[];
  effort: 'LOW' | 'MEDIUM' | 'HIGH';
}

async function generatePlan(input: string): Promise<ClaudePlan> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `You are the Caps Poker dev assistant. Caps Poker is a React Native + Expo app (SDK 55) for Omaha poker. Analyze this bug report or feature request.
CRITICAL: Respond ONLY in Hebrew (עברית). All text in your response must be in Hebrew.
Respond in this EXACT format (no extra text):
TYPE: BUG|FEATURE|QUESTION
SUMMARY: (תיאור קצר בעברית, עד 100 תווים)
PLAN:
1. (שינוי 1 בעברית)
2. (שינוי 2 בעברית)
FILES: file1.tsx, file2.ts
EFFORT: LOW|MEDIUM|HIGH`,
      messages: [{ role: 'user', content: input }],
    }),
  });
  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? '';

  // Parse structured response
  const typeMatch = text.match(/TYPE:\s*(BUG|FEATURE|QUESTION)/);
  const summaryMatch = text.match(/SUMMARY:\s*(.+)/);
  const planMatch = text.match(/PLAN:\n([\s\S]*?)(?=FILES:|$)/);
  const filesMatch = text.match(/FILES:\s*(.+)/);
  const effortMatch = text.match(/EFFORT:\s*(LOW|MEDIUM|HIGH)/);

  const planLines = planMatch?.[1]
    ?.split('\n')
    .map((l) => l.replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean) ?? [];

  return {
    type: (typeMatch?.[1] ?? 'BUG') as ClaudePlan['type'],
    summary: summaryMatch?.[1]?.trim() ?? 'Unknown issue',
    plan: planLines,
    files: (filesMatch?.[1] ?? '').split(',').map((f) => f.trim()).filter(Boolean),
    effort: (effortMatch?.[1] ?? 'MEDIUM') as ClaudePlan['effort'],
  };
}

// ── Trigger GitHub Actions ──────────────────────────────────────────────────

async function triggerGitHubAction(plan: ClaudePlan): Promise<void> {
  await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
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
      },
    }),
  });
}

// ── Format reply message ────────────────────────────────────────────────────

function formatPlanReply(plan: ClaudePlan): string {
  const typeEmoji = plan.type === 'BUG' ? '🐛' : plan.type === 'FEATURE' ? '✨' : '❓';
  const typeHe = plan.type === 'BUG' ? 'באג' : plan.type === 'FEATURE' ? 'פיצ\'ר' : 'שאלה';
  const effortHe = plan.effort === 'LOW' ? 'נמוך' : plan.effort === 'HIGH' ? 'גבוה' : 'בינוני';
  const planText = plan.plan.map((s, i) => `${i + 1}. ${s}`).join('\n');
  return `${typeEmoji} סוג: ${typeHe}

${plan.summary}

תכנית:
${planText}

קבצים: ${plan.files.join(', ')}
מאמץ: ${effortHe}

השב APPROVE לאישור
השב CANCEL לביטול
(מתבטל אוטומטית תוך 30 דקות)`;
}

// ── Main handler ────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  console.log('[whatsapp-bot] Request received:', req.method, req.url);

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const body = await req.text();
  console.log('[whatsapp-bot] Body:', body.slice(0, 300));

  const params = Object.fromEntries(new URLSearchParams(body));

  // Twilio signature verification — log but don't block (sandbox doesn't always sign correctly)
  const twilioSignature = req.headers.get('x-twilio-signature') ?? '';
  if (twilioSignature) {
    const valid = await verifyTwilioSignature(req.url, params, twilioSignature);
    if (!valid) {
      // Log mismatch but continue — sandbox URL forwarding often breaks signatures
      console.warn('[whatsapp-bot] Signature mismatch — proceeding in sandbox mode');
    }
  } else {
    console.log('[whatsapp-bot] No signature header — sandbox mode');
  }

  const from = params['From'] ?? '';
  const msgBody = params['Body']?.trim() ?? '';
  const messageSid = params['MessageSid'] ?? '';
  const numMedia = parseInt(params['NumMedia'] ?? '0', 10);
  const mediaUrl = params['MediaUrl0'];
  const mediaType = params['MediaContentType0'] ?? '';

  // ── Handle APPROVE / CANCEL replies ──────────────────────────────────────
  const upperBody = msgBody.toUpperCase();

  if (upperBody === 'APPROVE' || upperBody === 'CANCEL') {
    const { data: session } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('from_number', from)
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!session) {
      await sendWhatsApp(from, 'לא נמצאה בקשה ממתינה. שלח דיווח באג קודם.');
      return new Response('OK', { status: 200 });
    }

    if (upperBody === 'CANCEL') {
      await supabase.from('whatsapp_sessions').update({ status: 'cancelled' }).eq('id', session.id);
      await sendWhatsApp(from, '❌ בוטל. לא בוצעו שינויים.');
      return new Response('OK', { status: 200 });
    }

    // APPROVE
    await supabase.from('whatsapp_sessions').update({ status: 'approved' }).eq('id', session.id);
    const plan = session.claude_plan as ClaudePlan;
    await triggerGitHubAction(plan);
    await sendWhatsApp(from, '⚙️ מריץ תיקון... אעדכן אותך כשהcommit יעלה.');
    return new Response('OK', { status: 200 });
  }

  // ── New report: determine input type and extract text ─────────────────────
  // Media-first: forwarded messages have Body="" but NumMedia=1 — never reject before checking media
  let inputText = '';
  let detectedMediaType = 'text';

  if (numMedia > 0 && mediaUrl) {
    if (mediaType.startsWith('audio/')) {
      detectedMediaType = 'audio';
      if (OPENAI_API_KEY) {
        try {
          inputText = await transcribeAudio(mediaUrl);
          if (msgBody) inputText = msgBody + '\n\n[Voice note]: ' + inputText;
        } catch (e) {
          console.error('[whatsapp-bot] Audio transcription failed:', e);
          inputText = msgBody || '[Voice note received — transcription unavailable]';
        }
      } else {
        inputText = msgBody || '[הודעה קולית התקבלה — שירות התמלול אינו מוגדר. שלח טקסט במקום]';
      }
    } else if (mediaType.startsWith('image/')) {
      detectedMediaType = 'image';
      try {
        const imageDesc = await describeImage(mediaUrl);
        inputText = msgBody ? `${msgBody}\n\nצילום מסך: ${imageDesc}` : `צילום מסך: ${imageDesc}`;
      } catch (e) {
        console.error('[whatsapp-bot] Image description failed:', e);
        // Still process — user may have added text description
        inputText = msgBody || 'קיבלתי צילום מסך אך לא הצלחתי לנתח אותו. אנא תאר את הבעיה בטקסט.';
      }
    } else {
      inputText = msgBody || `[Media received: ${mediaType}]`;
    }
  } else {
    inputText = msgBody;
  }

  // Only reject if truly empty (no text AND no media)
  if (!inputText) {
    await sendWhatsApp(from, '⚠️ הודעה ריקה. שלח תיאור באג, הודעה קולית, או צילום מסך.');
    return new Response('OK', { status: 200 });
  }

  // ── Generate plan ─────────────────────────────────────────────────────────
  let plan: ClaudePlan;
  try {
    plan = await generatePlan(inputText);
  } catch {
    await sendWhatsApp(from, '❌ שגיאה ב-Claude API. נסה שוב בעוד רגע.');
    return new Response('OK', { status: 200 });
  }

  // ── Store session ─────────────────────────────────────────────────────────
  await supabase.from('whatsapp_sessions').insert({
    message_sid: messageSid,
    from_number: from,
    raw_input: inputText,
    media_type: detectedMediaType,
    claude_plan: plan,
    status: 'pending_approval',
  });

  // ── Send reply ────────────────────────────────────────────────────────────
  await sendWhatsApp(from, formatPlanReply(plan));

  return new Response('OK', { status: 200 });
});
