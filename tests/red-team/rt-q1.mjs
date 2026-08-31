const URL='https://gxrpunvhjcrzqnitbqah.supabase.co';
const ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4cnB1bnZoamNyenFuaXRicWFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTc5OTksImV4cCI6MjA4ODkzMzk5OX0.MLHYIbU4saCHq0eQbwUzyfAl_q9TLgepKf8iNDDav-Q';
const rpc=async(n,a)=>{const r=await fetch(`${URL}/rest/v1/rpc/${n}`,{method:'POST',headers:{apikey:ANON,Authorization:`Bearer ${ANON}`,'Content-Type':'application/json'},body:JSON.stringify(a)});return {s:r.status,b:(await r.text()).slice(0,150)};};
const show=(label,r)=>console.log(`  ${label.padEnd(52)} ${r.s}  ${r.b}`);

console.log('\n== legit referral path still works (record_reward via redeem_referral) ==');
// create a referral code on a referrer device, redeem from a fresh redeemer
let c=await rpc('create_referral_code',{p_device_id:'RT-REF-OWNER'});
show('create_referral_code(RT-REF-OWNER)',c);
let code=null; try{code=JSON.parse(c.b).code||JSON.parse(c.b).referral_code||JSON.parse(c.b).data?.code;}catch{}
console.log('     code parsed:', code);

console.log('\n== spend_chips with a NEGATIVE amount (does a debit become a credit?) ==');
show('spend_chips(RT-NEG, buy, -5000)', await rpc('spend_chips',{p_device_id:'RT-NEG',p_event_type:'buy_emotes',p_amount:-5000}));

console.log('\n== earn_chips negative amount ==');
show('earn_chips(RT-NEG, hand_won, -5000)', await rpc('earn_chips',{p_device_id:'RT-NEG',p_event_type:'hand_won',p_amount:-5000}));

console.log('\n== record_hand_net: self-reported win, find the daily ceiling ==');
for(let i=1;i<=4;i++){ show(`record_hand_net(RT-HAND, 10000, h${i})`, await rpc('record_hand_net',{p_device_id:'RT-HAND',p_net:10000,p_hand_id:'rt-h'+i})); }
show('record_hand_net(RT-HAND, 10000, NO hand_id)', await rpc('record_hand_net',{p_device_id:'RT-HAND',p_net:10000}));

console.log('\n== submit_score: does the 5000/day ceiling hold? ==');
for(let i=1;i<=4;i++){ show(`submit_score(RT-SCORE, chips=${(i*100000)})`, await rpc('submit_score',{p_device_id:'RT-SCORE',p_player_name:'x',p_total_chips:i*100000,p_hands_played:1,p_hands_won:1,p_biggest_win:1})); }

console.log('\n== purchase_item with a bogus/negative item ==');
show('purchase_item(RT-BUY, __free__)', await rpc('purchase_item',{p_device_id:'RT-BUY',p_item_type:'__free__'}));

console.log('\n== watch_rewarded_ad for an arbitrary uuid (no session, auth.uid null-bypass) ==');
show('watch_rewarded_ad(random uuid)', await rpc('watch_rewarded_ad',{p_user_id:'00000000-0000-4000-8000-000000009999'}));

console.log('\n== claim_mission_d with an invented mission id ==');
show('claim_mission_d(RT-M, fake_mission)', await rpc('claim_mission_d',{p_device_id:'RT-M',p_mission_id:'fake_mission'}));

console.log('\n== redeem_starter_offer as a stranger ==');
show('redeem_starter_offer(RT-SP)', await rpc('redeem_starter_offer',{p_device_id:'RT-SP',p_user_id:null,p_receipt_id:'rt-forged',p_platform:'web'}));
