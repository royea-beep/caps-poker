// READ-ONLY probe of the realtime authorization decision. Nothing is written, no config changed.
// Joins the Realtime socket as `anon` and asks for (a) the PUBLIC shared room topic and
// (b) the PRIVATE per-player topic, then reports what the server replies to each.
const REF = 'gxrpunvhjcrzqnitbqah';
const KEY = process.env.ANON_KEY;
const URL = `wss://${REF}.supabase.co/realtime/v1/websocket?apikey=${KEY}&vsn=1.0.0`;

function join(topic, isPrivate) {
  return new Promise((resolve) => {
    const ws = new WebSocket(URL);
    const ref = '1';
    let done = false;
    const finish = (r) => { if (!done) { done = true; try { ws.close(); } catch {} resolve(r); } };
    setTimeout(() => finish({ topic, private: isPrivate, result: 'TIMEOUT (no reply in 12s)' }), 12000);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        topic: `realtime:${topic}`,
        event: 'phx_join',
        ref,
        payload: { config: { broadcast: { self: false }, presence: { key: '' }, private: isPrivate } },
      }));
    };
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.event === 'phx_reply' && msg.ref === ref) {
        finish({ topic, private: isPrivate, status: msg.payload?.status,
          reason: msg.payload?.response?.reason ?? msg.payload?.response?.error ?? null });
      }
      if (msg.event === 'phx_error') finish({ topic, private: isPrivate, status: 'phx_error' });
    };
    ws.onerror = () => finish({ topic, private: isPrivate, result: 'socket error' });
  });
}

const room = process.env.ROOM ?? 'P9LC';
const dev = process.env.DEV ?? 'ca6a-e64c-6c65';
const out = [];
out.push(await join(`caps-room-${room}`, false));            // shared room channel, public
out.push(await join(`caps-room-${room}-p-${dev}`, true));     // per-player topic, PRIVATE
out.push(await join(`caps-room-${room}-p-${dev}`, false));    // same topic, asked for publicly
console.log(JSON.stringify(out, null, 1));
