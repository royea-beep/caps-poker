const URL='https://gxrpunvhjcrzqnitbqah.supabase.co';
const ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4cnB1bnZoamNyenFuaXRicWFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTc5OTksImV4cCI6MjA4ODkzMzk5OX0.MLHYIbU4saCHq0eQbwUzyfAl_q9TLgepKf8iNDDav-Q';
const fn=async(path,init={})=>{const r=await fetch(`${URL}/functions/v1/${path}`,init);return {s:r.status,b:(await r.text()).slice(0,140)};};
const AH={Authorization:`Bearer ${ANON}`,apikey:ANON,'Content-Type':'application/json'};

console.log('== PAYMENT WEBHOOK: forged / tampered / replayed, from outside ==');
console.log('  no auth header:      ', (await fn('verify-purchase?provider=stub',{method:'POST',body:'{}'})).b);
console.log('  anon, no signature:  ', (await fn('verify-purchase?provider=stub',{method:'POST',headers:AH,body:JSON.stringify({device_id:'RT',package_id:'mega',receipt_id:'r1',status:'paid'})})).b);
console.log('  anon, forged sig:    ', (await fn('verify-purchase?provider=stub',{method:'POST',headers:{...AH,'x-caps-signature':'a'.repeat(64)},body:JSON.stringify({device_id:'RT',package_id:'mega',receipt_id:'r1',status:'paid'})})).b);
console.log('  provider=payplus:    ', (await fn('verify-purchase?provider=payplus',{method:'POST',headers:AH,body:'{}'})).b);

console.log('\n== verify_jwt:false EDGE FUNCTIONS reachable with NO key at all ==');
for(const p of ['resolve-hand','log-error','flush-outbound','analyze-bug-report','retriage-pending','legal','resolver-probe']){
  console.log(`  ${p.padEnd(20)}`, (await fn(p,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).s, (await fn(p,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).b);
}
