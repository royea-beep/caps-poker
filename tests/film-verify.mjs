/**
 * EMBED-THE-VIDEO — does the film section actually paint, in both languages, at both widths?
 * Asserts rather than prints: exits non-zero on any failure.
 *   ROOT=public          renders the working tree
 *   ROOT=/tmp/live-snap  renders the exact bytes the CDN served
 */
import { chromium, webkit } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = path.resolve(process.env.ROOT || 'public');
const OUT  = process.env.OUT || '/tmp/film-shots';
const PORT = Number(process.env.PORT || 8991);
const TAG  = process.env.TAG || 'local';
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html':'text/html', '.webp':'image/webp', '.png':'image/png', '.mp4':'video/mp4',
  '.css':'text/css', '.js':'text/javascript', '.ico':'image/x-icon', '.svg':'image/svg+xml' };
const srv = http.createServer((req,res)=>{
  const u = decodeURIComponent((req.url||'/').split('?')[0]);
  const f = path.join(ROOT,u);
  if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end('404');return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);
});
await new Promise(r=>srv.listen(PORT,r));
const BASE = `http://localhost:${PORT}`;
const HEB = /[֐-׿]/;
const rows=[], fail=[];
for (const [engine, L] of [['chromium',chromium],['webkit',webkit]]) {
  const b = await L.launch(engine==='chromium'
    ? { executablePath: process.env.CAPS_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' } : {});
  for (const lang of ['en','he']) for (const w of [320,393]) {
    const ctx = await b.newContext({ viewport:{width:w,height:900} });
    const page = await ctx.newPage();
    const net = [];
    page.on('response', r => net.push({ url:r.url(), status:r.status() }));
    await page.goto(`${BASE}/landing.html?lang=${lang}`, { waitUntil:'load', timeout:60000 });
    await page.waitForTimeout(2500);
    const m = await page.evaluate(() => {
      const v = document.querySelector('.film video');
      if (!v) return { present:false };
      const r = v.getBoundingClientRect(), cs = getComputedStyle(v);
      const fig = document.querySelector('.film');
      const fr = fig.getBoundingClientRect();
      const cta = document.querySelector('a.cta').getBoundingClientRect();
      const vis = el => { const c=getComputedStyle(el); const b=el.getBoundingClientRect();
        return c.display!=='none' && c.visibility!=='hidden' && +c.opacity>0 && b.width>2 && b.height>2; };
      const shownText = [...document.querySelectorAll('.film [data-l]')]
        .filter(vis).map(e=>({ l:e.getAttribute('data-l'), t:e.textContent.trim() }));
      return { present:true,
        controls:v.hasAttribute('controls'), muted:v.muted, autoplay:v.hasAttribute('autoplay'),
        preload:v.getAttribute('preload'), poster:v.getAttribute('poster'),
        src:v.currentSrc||v.getAttribute('src'),
        readyState:v.readyState, videoW:v.videoWidth, videoH:v.videoHeight, dur:v.duration,
        paused:v.paused, box:{w:Math.round(r.width),h:Math.round(r.height)},
        filmTop:Math.round(fr.top+scrollY), ctaTop:Math.round(cta.top+scrollY),
        filmBeforeCta: fr.top < cta.top,
        heading: document.querySelector('.film h2').innerText.trim(),
        shownText,
        pageText: document.body.innerText };
    });
    const posterResp = net.find(n=>/explainer-poster\.webp/.test(n.url));
    const vidResp    = net.find(n=>/caps-explainer-FINAL\.mp4/.test(n.url));
    const filmText = m.shownText.map(x=>x.t).join(' ');
    const row = { engine, lang, width:w, present:m.present, controls:m.controls, muted:m.muted,
      autoplay:m.autoplay, preload:m.preload, paused:m.paused, poster:m.poster,
      posterStatus: posterResp?posterResp.status:null, videoStatus: vidResp?vidResp.status:null,
      readyState:m.readyState, videoW:m.videoW, videoH:m.videoH, dur:m.dur,
      box:m.box, filmTop:m.filmTop, ctaTop:m.ctaTop, filmBeforeCta:m.filmBeforeCta,
      heading:m.heading, filmVisibleText:filmText,
      hebrewInFilmChrome: HEB.test(filmText) };
    rows.push(row);
    const F = (why)=>fail.push({engine,lang,width:w,why});
    if (!m.present) F('no <video> in .film');
    if (!m.controls) F('no controls');
    if (!m.muted) F('not muted');
    if (m.autoplay) F('autoplay is set');
    if (!m.paused) F('video is already playing');
    if (m.preload !== 'metadata') F(`preload is ${m.preload}`);
    if (!posterResp || posterResp.status !== 200) F(`poster did not load 200 (${posterResp?posterResp.status:'never requested'})`);
    if (!m.filmBeforeCta) F('film is not above the call to action');
    if (lang==='en' && HEB.test(filmText)) F('HEBREW inside the film section on the ENGLISH page');
    if (lang==='he' && !HEB.test(filmText)) F('film section is English on the HEBREW page');
    await page.screenshot({ path:`${OUT}/${TAG}-${lang}-${w}-${engine}.png`, fullPage:true });
    // a tight crop of the film section for looking at
    const fh = await page.locator('.film').boundingBox();
    if (fh) await page.locator('.film').screenshot({ path:`${OUT}/${TAG}-film-${lang}-${w}-${engine}.png` });
    await ctx.close();
  }
  await b.close();
}
await new Promise(r=>srv.close(r));
const report={ tag:TAG, root:ROOT, rows, failures:fail, failureCount:fail.length };
fs.writeFileSync(`${OUT}/film-${TAG}.json`, JSON.stringify(report,null,1));
console.log(JSON.stringify(report,null,1));
process.exit(fail.length?1:0);
