// sync-bugs-to-drive — receives bug report from BugReporter and logs it
// Primarily exists to provide a proper CORS endpoint for web clients

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  // Require Supabase apikey OR Authorization header. Mobile client sends both.
  const apiKey = req.headers.get('apikey') ?? '';
  const auth = req.headers.get('Authorization') ?? '';
  if (!apiKey && !auth.startsWith('Bearer ')) {
    return new Response('unauthorized', { status: 401, headers: CORS_HEADERS });
  }

  try {
    const body = await req.json();
    // Log to console (visible in Supabase function logs)
    console.log('[sync-bugs-to-drive]', JSON.stringify({
      description: body.description,
      page: body.page,
      severity: body.severity,
      timestamp: body.timestamp,
    }));

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
