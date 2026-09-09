const URL='https://gxrpunvhjcrzqnitbqah.supabase.co';
const ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4cnB1bnZoamNyenFuaXRicWFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTc5OTksImV4cCI6MjA4ODkzMzk5OX0.MLHYIbU4saCHq0eQbwUzyfAl_q9TLgepKf8iNDDav-Q';
const rpc=async(n,a)=>{const r=await fetch(`${URL}/rest/v1/rpc/${n}`,{method:'POST',headers:{apikey:ANON,Authorization:`Bearer ${ANON}`,'Content-Type':'application/json'},body:JSON.stringify(a||{})});return (await r.text());};
const scan=(b)=>{const ids=b.match(/[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}/g);const uuids=b.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g);return {deviceIds:[...new Set(ids||[])].slice(0,4), uuids:[...new Set(uuids||[])].slice(0,4)};};
for(const n of ['list_public_tables','list_open_tables']){
  const b=await rpc(n,{}); const s=scan(b);
  console.log(`${n}: len=${b.length}  device-id-shaped: ${JSON.stringify(s.deviceIds)}  uuids: ${JSON.stringify(s.uuids)}`);
  console.log('  sample:', b.slice(0,260));
}
