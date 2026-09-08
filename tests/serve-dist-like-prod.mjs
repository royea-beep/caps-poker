/**
 * Serve dist/ the way PRODUCTION serves it — not the way a plain static server does.
 *
 * python3 -m http.server 404s every SPA route, and the first run of the stranger walk reported
 * 32 of 33 routes broken because of it. That is a RIG defect reading as a product defect, and it
 * is the third time this week a probe has accused the product of something the probe was doing.
 * This applies dist/vercel.json's ACTUAL rules: the explicit .html rewrites, then the catch-all
 * /((?!.*\.).*) -> /index.html, so a dotted path still 404s honestly.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve('dist');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const rules = cfg.rewrites.map(r => ({ re: new RegExp('^' + r.source + '$'), to: r.destination }));
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.webp':'image/webp', '.jpg':'image/jpeg', '.svg':'image/svg+xml',
  '.ico':'image/x-icon', '.ttf':'font/ttf', '.woff2':'font/woff2', '.mp4':'video/mp4' };
http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(ROOT, p);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    const hit = rules.find(r => r.re.test(p));
    if (hit) file = path.join(ROOT, hit.to);
    else { res.writeHead(404, {'Content-Type':'text/plain'}); return res.end('The page could not be found NOT_FOUND'); }
  }
  if (!fs.existsSync(file)) { res.writeHead(404, {'Content-Type':'text/plain'}); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(8899, () => console.log('SPA server on 8899; rewrite rules loaded from dist/vercel.json:', rules.length));
