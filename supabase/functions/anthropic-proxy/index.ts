import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

// Rate limiting: max 10 requests per device per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(deviceId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(deviceId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(deviceId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-Device-ID, Authorization, apikey',
      },
    });
  }

  // verify_jwt=true is enforced by Supabase platform — this function only runs if JWT is valid
  // We still keep rate limiting per device:
  const deviceId = req.headers.get('X-Device-ID') ?? 'anonymous';
  if (!checkRateLimit(deviceId)) {
    return new Response(JSON.stringify({ error: 'rate_limit_exceeded' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400 });
  }

  const { prompt, model = 'claude-haiku-4-5-20251001', max_tokens = 300, system } = body as {
    prompt: string;
    model?: string;
    max_tokens?: number;
    system?: string;
  };

  if (!prompt) {
    return new Response(JSON.stringify({ error: 'prompt required' }), { status: 400 });
  }

  const anthropicBody: Record<string, unknown> = {
    model,
    max_tokens,
    messages: [{ role: 'user', content: prompt }],
  };
  if (system) anthropicBody.system = system;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicBody),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.error('[anthropic-proxy] error:', err);
    return new Response(JSON.stringify({ error: 'upstream_error' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
