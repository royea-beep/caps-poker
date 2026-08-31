const URL='https://gxrpunvhjcrzqnitbqah.supabase.co';
const ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4cnB1bnZoamNyenFuaXRicWFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTc5OTksImV4cCI6MjA4ODkzMzk5OX0.MLHYIbU4saCHq0eQbwUzyfAl_q9TLgepKf8iNDDav-Q';
const rpc=async(n,a)=>{const r=await fetch(`${URL}/rest/v1/rpc/${n}`,{method:'POST',headers:{apikey:ANON,Authorization:`Bearer ${ANON}`,'Content-Type':'application/json'},body:JSON.stringify(a)});return {s:r.status,b:(await r.text()).slice(0,110)};};
console.log('RE-ATTACK the reapers AFTER revoke — must be refused now:');
console.log('  evict_ghost_seats(0):          ', (await rpc('evict_ghost_seats',{p_stale_seconds:0})).b);
console.log('  finish_wedged_playing_rooms(0):', (await rpc('finish_wedged_playing_rooms',{p_stale_seconds:0})).b);
console.log('  cleanup_expired_rooms():       ', (await rpc('cleanup_expired_rooms',{})).b);
