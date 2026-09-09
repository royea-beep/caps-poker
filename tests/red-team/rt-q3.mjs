const URL='https://gxrpunvhjcrzqnitbqah.supabase.co';
const ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4cnB1bnZoamNyenFuaXRicWFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTc5OTksImV4cCI6MjA4ODkzMzk5OX0.MLHYIbU4saCHq0eQbwUzyfAl_q9TLgepKf8iNDDav-Q';
const rpc=async(n,a)=>{const r=await fetch(`${URL}/rest/v1/rpc/${n}`,{method:'POST',headers:{apikey:ANON,Authorization:`Bearer ${ANON}`,'Content-Type':'application/json'},body:JSON.stringify(a)});return {s:r.status,b:(await r.text()).slice(0,160)};};

console.log('== create MY OWN table as a stranger ==');
const c=await rpc('create_table',{p_player_count:2,p_host_id:'00000000-0000-4000-8000-0000000000aa',p_host_name:'RT-HOST',p_device_id:'RT-ROOM-OWNER'});
console.log('  create_table:', c.b);
let code=null; try{code=JSON.parse(c.b).room_code||JSON.parse(c.b).code;}catch{}
console.log('  room_code:', code);

if(code){
  console.log('\n== finish MY OWN room as a DIFFERENT stranger (no auth needed) ==');
  console.log('  finish_table:', (await rpc('finish_table',{p_room_code:code})).b);
}

console.log('\n== prove anon can EXECUTE the global reapers (harmless huge arg → matches nothing) ==');
console.log('  evict_ghost_seats(999999999):        ', (await rpc('evict_ghost_seats',{p_stale_seconds:999999999})).b);
console.log('  finish_wedged_playing_rooms(999999999):', (await rpc('finish_wedged_playing_rooms',{p_stale_seconds:999999999})).b);
console.log('  cleanup_expired_rooms():             ', (await rpc('cleanup_expired_rooms',{})).b);
console.log('\n  (evicted:0 / finished:0 = the call REACHED the function body and ran as anon; swapping');
console.log('   the argument to 0 would evict/finish everything. NOT fired against production.)');
