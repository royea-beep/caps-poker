// Is track_event bounded UPSTREAM by Supabase's gateway? Measured, not assumed.
// 200 anon RPC calls at concurrency 20. Every row is deleted afterwards.
const URL = 'https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/rpc/track_event';
const KEY = process.env.ANON_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const N = 200, CONC = 20;

const codes = new Map();
let firstNon2xx = null;
const t0 = Date.now();
let i = 0;
async function worker(w) {
  while (true) {
    const n = i++;
    if (n >= N) return;
    const r = await fetch(URL, { method: 'POST', headers: H, body: JSON.stringify({
      p_event: 'probe_burst', p_device_id: `probe-burst-${w}`, p_screen: 'probe',
      p_data: { n }, p_user_id: null }) });
    codes.set(r.status, (codes.get(r.status) ?? 0) + 1);
    if (r.status >= 300 && !firstNon2xx) firstNon2xx = { status: r.status, body: (await r.text()).slice(0, 200) };
  }
}
await Promise.all(Array.from({ length: CONC }, (_, w) => worker(w)));
const ms = Date.now() - t0;
console.log(JSON.stringify({ calls: N, concurrency: CONC, ms, perSec: Math.round(N / (ms / 1000)),
  codes: Object.fromEntries(codes), firstNon2xx }, null, 1));
