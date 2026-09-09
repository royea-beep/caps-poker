import { chromium } from 'playwright-core';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = 'http://localhost:8099';
const OUT = '/home/user/caps-poker/docs/total-audit';
const seed = (lang,skip) => `try{localStorage.setItem('caps-poker-storage', JSON.stringify({state:{handsPlayed:9, config:{numberOfPlayers:3}}, version:2}));localStorage.setItem('caps_language','${lang}');${skip?"localStorage.setItem('has_seen_interactive_tutorial','true');":''}}catch(e){}`;

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox','--force-device-scale-factor=1'] });

// ============ CONTRAST PROBE (verify-the-verifier) ============
const ctx = await browser.newContext({ viewport:{width:393,height:852}, deviceScaleFactor:1 });
const page = await ctx.newPage();
await page.addInitScript(seed('en',true));
await page.goto(BASE + '/', { waitUntil:'domcontentloaded' });
await page.waitForTimeout(5000);

const probeResult = await page.evaluate(() => {
  // --- contrast math (WCAG) ---
  const lin = (c)=>{c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);};
  const L = ([r,g,b])=>0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);
  const parse = (s)=>{const m=s.match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(',').map(x=>parseFloat(x));return {rgb:[p[0],p[1],p[2]], a:p.length>3?p[3]:1};};
  const composite=(fg,bg)=>fg.map((c,i)=>Math.round(c*1+bg[i]*0)); // fg opaque assumed
  const ratio=(a,b)=>{const la=L(a),lb=L(b);const hi=Math.max(la,lb),lo=Math.min(la,lb);return (hi+0.05)/(lo+0.05);};
  // effective background: walk up to first non-transparent bg
  const effBg=(el)=>{let n=el;for(let i=0;i<12&&n;i++){const b=parse(getComputedStyle(n).backgroundColor);if(b&&b.a>0.5)return b.rgb;n=n.parentElement;}return [10,30,20];};
  const measure=(el)=>{
    const cs=getComputedStyle(el);const fg=parse(cs.color);if(!fg)return null;
    const bg=effBg(el); // start at el itself so a button's own fill counts as its text bg
    const size=parseFloat(cs.fontSize);const bold=parseInt(cs.fontWeight)>=600;
    const large = size>=24 || (size>=18.66 && bold);
    return {ratio:ratio(fg.rgb,bg), size, large, min: large?3.0:4.5};
  };
  // --- 1) PLANT a known-bad control and confirm the probe flags it ---
  const bad=document.createElement('button');
  bad.textContent='PLANTED BAD';
  bad.style.cssText='position:fixed;top:0;left:0;color:#8a8a8a;background:#7f7f7f;font-size:14px;z-index:99999';
  document.body.appendChild(bad);
  const badM=measure(bad);
  const verifierWorks = badM && badM.ratio < 3.0; // must catch ~1.1:1 grey-on-grey
  bad.remove();
  // --- 2) real scan of button labels + headers ---
  const targets=[...document.querySelectorAll('div,span,a,p,button,[role="button"],[role="header"]')];
  const seen=new Set(); const fails=[];
  let checked=0;
  for(const el of targets){
    // must have its OWN direct text (a text leaf), not just descendant text
    const directText=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();
    if(!directText || directText.length>40) continue;
    const b=el.getBoundingClientRect();
    if(b.width<2||b.height<2||b.left>393||b.top>852||b.bottom<0||b.right<0) continue;
    const cs0=getComputedStyle(el); if(cs0.visibility==='hidden'||parseFloat(cs0.opacity)<0.1) continue;
    const key=directText+Math.round(b.x)+Math.round(b.y); if(seen.has(key))continue; seen.add(key);
    const m=measure(el); if(!m)continue; checked++;
    m.txt=directText;
    if(m.ratio < m.min) fails.push({txt:directText.slice(0,30), ratio:+m.ratio.toFixed(2), min:m.min, size:+m.size.toFixed(0)});
  }
  return { verifierWorks, plantedRatio:+badM.ratio.toFixed(2), checked, failCount:fails.length, fails:fails.slice(0,15) };
});
console.log('CONTRAST VERIFIER WORKS (flags planted grey-on-grey):', probeResult.verifierWorks, 'plantedRatio=', probeResult.plantedRatio);
console.log('HOME contrast: checked', probeResult.checked, 'fails', probeResult.failCount, JSON.stringify(probeResult.fails));

// ============ FOCUS TRAP CHECK (home) ============
const focusSeq=[];
for(let i=0;i<24;i++){
  await page.keyboard.press('Tab');
  const f=await page.evaluate(()=>{const e=document.activeElement;return e?((e.getAttribute&&e.getAttribute('aria-label'))||e.textContent||e.tagName).trim().slice(0,28):'none';});
  focusSeq.push(f);
}
const distinct=[...new Set(focusSeq)];
console.log('FOCUS: distinct focus stops in 24 tabs =', distinct.length, '| trapped=', distinct.length<=1);
console.log('FOCUS seq sample:', JSON.stringify(focusSeq.slice(0,12)));
await ctx.close();

// ============ E2 GREYSCALE winner-cue test (results) ============
const ctx2 = await browser.newContext({ viewport:{width:393,height:852}, deviceScaleFactor:1 });
const p2 = await ctx2.newPage();
await p2.addInitScript(seed('en',true));
await p2.goto(BASE + `/game?practice=true&players=3&fresh=1`, { waitUntil:'domcontentloaded' });
await p2.waitForTimeout(5000);
try{await p2.getByRole('button',{name:/Auto-Place ALL/i}).click({timeout:4000});await p2.waitForTimeout(1200);}catch(e){}
try{await p2.getByRole('button',{name:/READY|Confirm/i}).click({timeout:4000});await p2.waitForTimeout(2800);}catch(e){}
for(let i=0;i<12 && !p2.url().includes('/results');i++){ await p2.mouse.click(196,430); await p2.waitForTimeout(2200); }
await p2.waitForTimeout(1500);
if(p2.url().includes('/results')){
  await p2.screenshot({path:`${OUT}/E2-results-color.png`, fullPage:true});
  await p2.evaluate(()=>{document.documentElement.style.filter='grayscale(1) contrast(1)';});
  await p2.waitForTimeout(400);
  await p2.screenshot({path:`${OUT}/E2-results-greyscale.png`, fullPage:true});
  console.log('E2 greyscale screenshot written (results reached)');
} else console.log('E2: did not reach results, url=', p2.url());
await ctx2.close();
await browser.close();
