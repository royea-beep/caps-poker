const { chromium } = require('playwright');
const MAP=[{n:2,bc:4},{n:3,bc:3},{n:4,bc:2}];
const W=[440,390,320];
(async()=>{
  const browser=await chromium.launch();
  const ctx=await browser.newContext({viewport:{width:440,height:956},deviceScaleFactor:2});
  const page=await ctx.newPage();
  await page.goto('https://caps.ftable.co.il/game',{waitUntil:'networkidle',timeout:30000});
  await page.waitForTimeout(2000);
  for(const {n,bc} of MAP){
    await page.evaluate((n)=>{const k='caps-poker-storage';const o=JSON.parse(localStorage.getItem(k));o.state.config.numberOfPlayers=n;localStorage.setItem(k,JSON.stringify(o));},n);
    for(const w of W){
      await page.setViewportSize({width:w,height:956});
      await page.goto('https://caps.ftable.co.il/game',{waitUntil:'networkidle',timeout:30000});
      await page.waitForTimeout(2600);
      // measure rendered geometry from DOM: find card-ish + board-ish nodes
      const geo=await page.evaluate(()=>{
        const W=window.innerWidth;
        // hand cards: small white rounded nodes near bottom; boards: large bordered containers
        const all=[...document.querySelectorAll('div')];
        // heuristic: find the "YOUR HAND" label, then sibling card widths
        let handCards=[], boardW=[];
        all.forEach(el=>{ const r=el.getBoundingClientRect(); const bg=getComputedStyle(el).backgroundColor;
          // white-ish small cards
          if(r.width>12&&r.width<70&&r.height>r.width&&r.height<120&&/255, 255, 255|250, 250|245, 245|252/.test(bg)&&r.top>window.innerHeight*0.55) handCards.push(Math.round(r.width));
        });
        return { W, handCardWmode: (handCards.sort((a,b)=>handCards.filter(v=>v===a).length-handCards.filter(v=>v===b).length).pop())||null, handCount:handCards.length };
      });
      const fn=`qa/qa-bc${bc}-${w}.png`;
      await page.screenshot({path:fn});
      console.log(`bc=${bc} w=${w} -> ${fn} | handCardW~${geo.handCardWmode} (n=${geo.handCount})`);
    }
  }
  await browser.close();
})().catch(e=>{console.error('FAIL:',e.message);process.exit(1);});
