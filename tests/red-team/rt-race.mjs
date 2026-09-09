const URL='https://gxrpunvhjcrzqnitbqah.supabase.co';
const ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4cnB1bnZoamNyenFuaXRicWFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTc5OTksImV4cCI6MjA4ODkzMzk5OX0.MLHYIbU4saCHq0eQbwUzyfAl_q9TLgepKf8iNDDav-Q';
const rpc=(n,a)=>fetch(`${URL}/rest/v1/rpc/${n}`,{method:'POST',headers:{apikey:ANON,Authorization:`Bearer ${ANON}`,'Content-Type':'application/json'},body:JSON.stringify(a)}).then(r=>r.text());
const D='RT-RACE-'+Date.now().toString(36);
console.log('RACE: 12 PARALLEL record_reward(2000) on fresh device',D,'(cap is 5000/day)');
const rs=await Promise.all(Array.from({length:12},(_,i)=>rpc('record_reward',{p_device_id:D,p_amount:2000,p_event_type:'race'+i,p_once:false})));
const granted=rs.map(b=>{try{return JSON.parse(b).granted||0;}catch{return 0;}});
console.log('  grants:', granted.join(','));
console.log('  TOTAL GRANTED:', granted.reduce((a,b)=>a+b,0), '(if > 5000, the daily cap raced)');
