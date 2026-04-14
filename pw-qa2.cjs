'use strict';
process.chdir('C:/Projects/Caps');
const { chromium } = require('./node_modules/playwright/index.js');
const path = require('path');
const fs = require('fs');
const BASE_URL = 'http://localhost:8082';
const VIEWPORTS = [
  { width: 375, height: 667, label: '375_iPhone-SE' },
  { width: 390, height: 844, label: '390_iPhone-12' },
  { width: 393, height: 852, label: '393_iPhone-15' },
  { width: 402, height: 874, label: '402_iPhone-17' },
  { width: 414, height: 896, label: '414_iPhone-11' },
  { width: 428, height: 926, label: '428_iPhone-12ProMax' },
  { width: 430, height: 932, label: '430_iPhone-16ProMax' },
  { width: 440, height: 956, label: '440_iPhone-17ProMax' },
  { width: 744, height: 1133, label: '744_iPad-Mini' },
  { width: 810, height: 1080, label: '810_iPad-9th' },
  { width: 820, height: 1180, label: '820_iPad-Air' },
  { width: 834, height: 1194, label: '834_iPad-Pro11' },
  { width: 1024, height: 1366, label: '1024_iPad-Pro12' }
];
const GS = '{"state":{"chips":1200,"bestChips":1200,"config":{"numberOfPlayers":2,"potPerBoard":25,"arrangementTime":60,"boardRevealDuration":5,"turnRevealDelay":800,"completeBonusDisplay":3,"startingChips":1000,"completeBonusPercent":50,"botSpeedMin":1500,"botSpeedMax":4000,"soundEnabled":false,"soundVolume":0,"revealSpeed":"normal","botDifficulty":"easy"},"handsPlayed":10,"handsWon":6,"biggestWin":75,"playerName":"Player","playerAvatar":"P","notificationsEnabled":false,"cardTheme":"v1","homeTheme":"dark_gold","buttonStyle":"solid","friendsBg":"none","fourColorSuits":false,"colorblindMode":false,"handSortMethod":"caps","orientation":"portrait","visualTheme":"classic","lastDailyRewardClaim":null,"dailyRewardStreak":0,"lastFreeRefill":null,"totalChipsEarned":200,"totalChipsSpent":100,"unlockedAchievements":[],"currentWinStreak":2,"bestWinStreak":3},"version":0}';
async function mkPage(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', () => {});
  await page.addInitScript(function(gs) {
    localStorage.setItem('caps_language', 'en');
    localStorage.setItem('caps-poker-storage', gs);
    localStorage.setItem('caps_games_played', '99');
    localStorage.setItem('guidedModeForced', 'false');
    localStorage.setItem('caps_tutorial_seen', 'true');
    localStorage.setItem('has_seen_interactive_tutorial', 'true');
    var d2 = new Date(); var weekKey = "recap_" + d2.getFullYear() + "_" + Math.ceil(d2.getDate() / 7); localStorage.setItem("recap_week", weekKey); localStorage.setItem("caps_daily_reward_popup_shown", "1");
  }, GS);
  return { ctx, page };
}
async function goHome(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2500);
}
async function goGame(page) {
  await page.goto(BASE_URL + '/game', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  return page.url();
}
async function main() {
  var phase = process.argv[2] || 'before';
  var outDir = 'C:/Projects/Caps/screenshots/' + phase;
  fs.mkdirSync(outDir, { recursive: true });
  console.log('=== CAPS QA ' + phase + ' ===');
  var browser = await chromium.launch({ headless: true });
  var ok = 0, fail = 0;
  var domIssues = {};
  for (var vp of VIEWPORTS) {
    console.log('\n-- ' + vp.label + ' --');
    // HOME
    try {
      var h = await mkPage(browser, vp.width, vp.height);
      await goHome(h.page);
      await h.page.screenshot({ path: path.join(outDir, vp.label+'_home.png') });
      console.log('  home OK'); ok++;
      await h.ctx.close().catch(()=>{});
    } catch(e) { console.error('  home ERR: '+e.message.slice(0,80)); fail++; }
    // GAME
    var gc = null, gp = null;
    try {
      var g = await mkPage(browser, vp.width, vp.height);
      gc = g.ctx; gp = g.page;
      var url = await goGame(gp);
      await gp.screenshot({ path: path.join(outDir, vp.label+'_game.png') });
      console.log('  game OK url=' + url.slice(-20)); ok++;
      var inf = await gp.evaluate(function() {
        var ov=[];
        document.querySelectorAll('*').forEach(function(el){
          var r=el.getBoundingClientRect();
          if(r.right>window.innerWidth+5&&r.width>10) ov.push((el.className||'').toString().slice(0,30)+' r='+r.right.toFixed(0));
        });
        return {w:window.innerWidth,docW:document.documentElement.scrollWidth,ov:ov.length,items:ov.slice(0,3),txt:document.body.textContent.trim().slice(0,60)};
      }).catch(function(e){return{error:e.message};});
      domIssues[vp.label]=inf;
      console.log('  DOM w='+inf.w+' docW='+inf.docW+' overflow='+inf.ov+' txt='+inf.txt);
      if(inf.ov>0) inf.items.forEach(function(o){console.log('    OVERFLOW: '+o);});
    } catch(e) { console.error('  game ERR: '+e.message.slice(0,80)); fail++; }
    // RESULTS
    try {
      var rp = gp || (await mkPage(browser, vp.width, vp.height)).page;
      await rp.goto(BASE_URL+'/results', { waitUntil: 'networkidle', timeout: 15000 });
      await rp.waitForTimeout(1500);
      await rp.screenshot({ path: path.join(outDir, vp.label+'_results.png') });
      console.log('  results OK'); ok++;
    } catch(e) { console.error('  results ERR: '+e.message.slice(0,80)); fail++; }
    if (gc) await gc.close().catch(()=>{});
  }
  await browser.close();
  var ow=Object.entries(domIssues).filter(function(e){return e[1].ov>0;}).map(function(e){return e[0];});
  console.log('\n=== DONE: '+ok+' OK, '+fail+' FAIL ===');
  console.log('Overflow at: '+(ow.length?ow.join(', '):'NONE'));
}
main().catch(console.error);
