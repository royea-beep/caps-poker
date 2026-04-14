// read-sms-temp — Read latest incoming SMS for a Twilio number
// GET ?to=+14087153698&limit=1
// Uses CAPS Twilio secrets — delete after Craigslist verification done

const TWILIO_SID   = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const url   = new URL(req.url);
  const to    = url.searchParams.get("to") || "+14087153698";
  const limit = url.searchParams.get("limit") || "5";

  const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
  const toEncoded = encodeURIComponent(to);

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json` +
    `?To=${toEncoded}&PageSize=${limit}`,
    { headers: { Authorization: `Basic ${auth}` } }
  );

  if (!res.ok) {
    const err = await res.text();
    return Response.json({ error: `Twilio error (${res.status}): ${err.slice(0, 200)}` }, { status: 500 });
  }

  const data = await res.json();
  const messages = (data.messages || []).map((m: Record<string, unknown>) => ({
    from:     m.from,
    to:       m.to,
    body:     m.body,
    status:   m.status,
    sent_at:  m.date_sent,
  }));

  return Response.json({ count: messages.length, messages });
});
