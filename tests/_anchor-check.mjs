import { chromium } from 'playwright';
import { measure, show } from './probe-kit.mjs';
const URL='https://caps.ftable.co.il';
const SEED={caps_tutorial_seen:'true',caps_onboarding_done:'true',has_seen_interactive_tutorial:'true',caps_games_played:'99'};
const fire=`(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
const mk=(t,C)=>new C(t,{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:t.includes('up')?0:1,isPrimary:true});
['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>el.dispatchEvent(mk(t,t.startsWith('pointer')?PointerEvent:MouseEvent)));}`;
const b=await chromium.launch({headless:false});
const c=await b.newContext({viewport:{width:375,height:812}});
await c.addInitScript(s=>{for(const[k,v]of Object.entries(s)){try{localStorage.setItem(k,v)}catch{}}},SEED);
const p=await c.newPage();
await p.goto(URL+'/game?practice=true&players=3&fresh=1',{waitUntil:'load',timeout:120000});
await p.waitForTimeout(9000);
console.log('ROOT MOUNTED:', await measure(p,`(()=>document.getElementById('root').children.length)()`,{label:'root'}));
await p.evaluate(`window.__f=${fire}`);
await p.evaluate(`(()=>{const x=[...document.querySelectorAll('button,[role="button"]')].find(e=>/auto-place all/i.test(e.getAttribute('aria-label')||e.textContent||''));if(x)window.__f(x);})()`);
await p.waitForTimeout(1200);
await p.evaluate(`(()=>{const r=document.querySelector('[data-testid="ready-button"]');if(r)window.__f(r);})()`);
await p.waitForTimeout(9000);
const r=await measure(p,`(()=>{const e=document.querySelector('[data-testid="community-row"]');if(!e)return{found:false};
const b=e.getBoundingClientRect();const leaves=[...e.querySelectorAll('*')].filter(n=>!n.children.length);
return{found:true,suits:leaves.filter(n=>/^[\u2660\u2665\u2666\u2663]$/.test((n.textContent||'').trim())).length,
ranks:leaves.filter(n=>/^(10|[2-9AKQJ])$/.test((n.textContent||'').trim())).length,
top:Math.round(b.top),bottom:Math.round(b.bottom),h:Math.round(b.height)};})()`,{label:'community'});
console.log('COMMUNITY ROW:', show(r));
await b.close();