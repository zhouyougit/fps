
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
let fails=0;
const ok=(n,c,d)=>{ if(!c) fails++; console.log((c?'PASS':'FAIL')+' · '+n+(d?' — '+JSON.stringify(d):'')); };
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:240000});
await page.waitForTimeout(800);
const base = await page.evaluate(()=>({
  count: window.__SX.challenges().count,
  limeLocked: document.querySelector('[data-x-seg="cross"] button[data-v="lime"]').disabled,
  goldLocked: document.querySelector('[data-x-seg="cross"] button[data-v="gold"]').disabled,
  colors: document.querySelectorAll('[data-x-seg="cross"] button').length
}));
ok('V13 初始挑战与锁定', base.count===0 && base.limeLocked && base.goldLocked && base.colors===6, base);

// briefing challenge rows
await page.evaluate(()=>{ window.__SX.unlockAll(); window.__SX.openMissions(); });
await page.waitForTimeout(400);
async function click(sel){ const b=await page.locator(sel).first().boundingBox(); if(!b) return false; await page.mouse.click(b.x+b.width/2,b.y+b.height/2); return true; }
await click('.x-mcard[data-idx="1"]'); await page.waitForTimeout(200);
await click('.x-camp-actions [data-x="go"]'); await page.waitForTimeout(300);
const br = await page.evaluate(()=>({on:document.querySelector('.x-brief').classList.contains('on'), rows:document.querySelectorAll('.x-br-chal li').length, text:[...document.querySelectorAll('.x-br-chal li')].map(x=>x.textContent)}));
ok('V13 简报挑战列表', br.on && br.rows===3, br);
await click('.x-br-actions [data-x="brief-back"]'); await page.waitForTimeout(200);
await click('.x-camp-actions [data-x="close"]'); await page.waitForTimeout(200);

// grant m1, unlock lime
const grant = await page.evaluate(()=>{
  window.__SX.challengeGrant('m1',{time:true,head:true,clean:true});
  return {count:window.__SX.challenges().count, lime:document.querySelector('[data-x-seg="cross"] button[data-v="lime"]').disabled, crimson:document.querySelector('[data-x-seg="cross"] button[data-v="crimson"]').disabled};
});
ok('V13 挑战解锁准星', grant.count===3 && grant.lime===false && grant.crimson===true, grant);

// complete m2 with all challenges
await page.evaluate(()=>{
  const G=window.__G; window.__SX.applyMission(1); G.game.start({skipIntro:true});
  G.game.run.time=100; G.game.run.retries=0; window.__SX.S.runHeadshots=8;
});
await page.waitForTimeout(1200);
await page.evaluate(()=>{ window.__SX.god(); window.__SX.cutAll(); });
await page.waitForTimeout(800);
await page.evaluate(()=>{ window.__G.game.run.evacT=0.01; });
await page.waitForTimeout(1500);
await page.evaluate(()=>{ const G=window.__G,e=G.level.extraction.pos; G.player.pos.set(e.x,e.y,e.z); });
let st='';
for(let i=0;i<14;i++){ await page.waitForTimeout(2000); st=await page.evaluate(()=>window.__G.game.state); if(st==='complete') break; }
await page.waitForTimeout(3000);
await page.evaluate(()=>window.__SX.openMissions());
await page.waitForTimeout(400);
const done = await page.evaluate(()=>({
  state:window.__G.game.state,
  m2:window.__SX.challenges().map.m2,
  count:window.__SX.challenges().count,
  note:(document.querySelector('.x-chal')||{}).textContent,
  crimson:document.querySelector('[data-x-seg="cross"] button[data-v="crimson"]').disabled,
  card:(document.querySelector('.x-mcard[data-idx="1"] .x-mchal')||{}).textContent
}));
ok('V13 通关结算挑战', done.state==='complete' && done.m2 && done.m2.time && done.m2.head && done.m2.clean && !!done.note, done);
ok('V13 六挑战解锁红色', done.count>=6 && done.crimson===false, {count:done.count,crimson:done.crimson});
ok('V13 行动卡挑战进度', done.card==='挑战 3/3', done.card);
ok('V13 无运行时错误', errs.length===0, errs.slice(0,3));
await page.screenshot({path:'tools/v13_debrief.png',timeout:120000});
await browser.close();
console.log(fails? fails+' 项失败':'全部通过');
process.exit(fails?1:0);
