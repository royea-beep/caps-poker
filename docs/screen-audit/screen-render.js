const http=require('http'),fs=require('fs'),path=require('path');const {chromium}=require('playwright');
const ROOT='/home/user/caps-poker/dist';const OUT=process.argv[3]||'/tmp/claude-0/-home-user-caps-poker/29632af8-42ab-5a2c-a794-9f3ca7c63779/scratchpad';
const CHROME='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';const TAG=process.argv[2]||'after';
const MIME={'.js':'text/javascript','.html':'text/html','.ico':'image/x-icon','.css':'text/css','.json':'application/json','.png':'image/png','.ttf':'font/ttf','.woff':'font/woff','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);let fp=path.join(ROOT,p);if(p==='/'||!fs.existsSync(fp)||fs.statSync(fp).isDirectory())fp=path.join(ROOT,'index.html');fs.readFile(fp,(e,b)=>{if(e){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'});res.end(b);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;const br=await chromium.launch({executablePath:CHROME,args:['--no-sandbox']});
const routes=[['profile','/profile'],['shop','/shop'],['lobby','/lobby']];const log={};
for(const [name,route] of routes){const pg=await br.newPage({viewport:{width:393,height:850},deviceScaleFactor:2});const errs=[];pg.on('pageerror',e=>errs.push(String(e).slice(0,70)));
try{await pg.goto(`${base}${route}?fresh=1`,{waitUntil:'domcontentloaded',timeout:40000});await pg.waitForTimeout(4000);const txt=await pg.evaluate(()=>(document.body.innerText||'').replace(/\n+/g,' | ').slice(0,80));await pg.screenshot({path:`${OUT}/screen-${TAG}-${name}.png`});log[name]={txt,err:errs.slice(0,2)};}catch(e){log[name]={error:String(e).slice(0,100)};}
await pg.close();}
await br.close();server.close();console.log(JSON.stringify(log,null,2));})();
