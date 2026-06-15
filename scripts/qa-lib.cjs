// returns {x,y} center IF the text element is the topmost (actually visible & clickable) element there
async function clickable(page, t, exact=false){
  return await page.evaluate(({t,exact})=>{
    const W=window.innerWidth,H=window.innerHeight;
    const els=[...document.querySelectorAll('div,button,[role="button"],span')];
    for(const el of els){ const tx=(el.innerText||el.textContent||'').trim();
      const ok=exact?tx===t:tx.includes(t);
      if(!ok||tx.length>40)continue;
      const r=el.getBoundingClientRect();
      const cx=Math.round(r.left+r.width/2), cy=Math.round(r.top+r.height/2);
      if(r.width<8||r.height<8||cx<0||cx>W||cy<0||cy>H)continue;
      const top=document.elementFromPoint(cx,cy);
      if(top && (top===el||el.contains(top)||top.contains(el))) return {x:cx,y:cy,tx};
    }
    return null;
  },{t,exact});
}
module.exports={clickable};
