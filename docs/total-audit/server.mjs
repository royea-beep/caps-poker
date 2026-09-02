import http from 'http';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('/home/user/caps-poker/web-audit-dist');
const PORT = 8099;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.map': 'application/json',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  let filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  // SPA: serve index.html for unknown non-file routes
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const ext = path.extname(urlPath);
    if (ext && ext !== '.html') { res.writeHead(404); res.end('not found'); return; }
    filePath = path.join(ROOT, 'index.html');
  }
  const ext = path.extname(filePath);
  if (ext === '.html') {
    let html = fs.readFileSync(filePath, 'utf8');
    // PATCH: defer -> type=module so the export boots
    html = html.replace(/<script([^>]*?)\sdefer\s*>/g, '<script$1 type="module">');
    html = html.replace(/<script([^>]*?)\sdefer>/g, '<script$1 type="module">');
    res.writeHead(200, { 'Content-Type': MIME['.html'] });
    res.end(html);
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});
server.listen(PORT, () => console.log('serving on http://localhost:' + PORT));
