const URL='https://gxrpunvhjcrzqnitbqah.supabase.co';
const ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4cnB1bnZoamNyenFuaXRicWFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTc5OTksImV4cCI6MjA4ODkzMzk5OX0.MLHYIbU4saCHq0eQbwUzyfAl_q9TLgepKf8iNDDav-Q';
const rpc=async(n,a)=>{const r=await fetch(`${URL}/rest/v1/rpc/${n}`,{method:'POST',headers:{apikey:ANON,Authorization:`Bearer ${ANON}`,'Content-Type':'application/json'},body:JSON.stringify(a)});return {s:r.status,b:(await r.text()).slice(0,160)};};
console.log('RE-ATTACK record_reward AFTER the fix (fresh device RT-MINT-02)\n');
for(let i=1;i<=6;i++){
  const r=await rpc('record_reward',{p_device_id:'RT-MINT-02',p_amount:2000,p_event_type:'rt_after_'+i,p_once:false});
  console.log(`  call ${i}  http ${r.s}  ${r.b}`);
}
console.log('\nEXPECT: first two land (2000+2000=4000, then would be 6000 > 5000 cap), then reward_cap_daily.');
