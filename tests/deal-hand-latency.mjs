// Measured, not estimated: deal_hand round trip from a client, as anon over HTTPS.
const URL = 'https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/rpc/deal_hand';
const KEY = process.env.ANON_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const room = process.env.ROOM ?? '8T39';
const dev = process.env.DEV ?? 'probe-deal-host';
const N = Number(process.env.N ?? 25);

const ms = [];
let firstBody = null, okCount = 0;
for (let i = 0; i < N; i++) {
  const t = Date.now();
  const r = await fetch(URL, { method: 'POST', headers: H,
    body: JSON.stringify({ p_room_code: room, p_device_id: dev, p_hand_no: 1 }) });
  const body = await r.json();
  ms.push(Date.now() - t);
  if (body?.ok) okCount++;
  if (!firstBody) firstBody = body;
}
ms.sort((a, b) => a - b);
const pct = (p) => ms[Math.min(ms.length - 1, Math.floor((p / 100) * ms.length))];
console.log(JSON.stringify({
  calls: N, ok: okCount, p50: pct(50), p95: pct(95), max: ms[ms.length - 1], min: ms[0],
  cards: firstBody?.your_cards?.length ?? null, boards: firstBody?.boards?.length ?? null,
}, null, 1));
if (okCount !== N) { console.error('NOT ALL CALLS SUCCEEDED'); process.exit(2); }
