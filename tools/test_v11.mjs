
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000}); console.log('ready');
await page.waitForTimeout(1200);
async function click(sel){ const loc=page.locator(sel).first(); try{await loc.scrollIntoViewIfNeeded();}catch(e){} const b=await loc.boundingBox(); if(!b) return false; await page.mouse.click(b.x+b.width/2,b.y+b.height/2); return true; }
await page.evaluate(()=>window.__SX.unlockAll());
await click('[data-x="campaign"]'); await page.waitForTimeout(300);
await click('.x-mcard[data-idx="1"]'); await page.waitForTimeout(200);
await click('.x-camp-actions [data-x="go"]'); await page.waitForTimeout(500);
console.log('brief', JSON.stringify(await page.evaluate(()=>({
  on:document.querySelector('.x-brief').classList.contains('on'),
  title:document.querySelector('.x-br-h').textContent,
  k:document.querySelector('.x-br-k').textContent,
  threats:document.querySelector('.x-br-threats').textContent,
  rec:document.querySelector('.x-br-rec').textContent,
  diff:document.querySelector('.x-br-diff').textContent,
  list:[...document.querySelectorAll('.x-br-list li')].map(x=>x.textContent)
}))));
await page.screenshot({path:'tools/v11_brief.png',timeout:120000});
await click('.x-br-actions [data-x="brief-go"]'); await page.waitForTimeout(2000);
console.log('launch', JSON.stringify(await page.evaluate(()=>({state:window.__G.game.state, mission:window.__G.game.currentMission.id, brief:document.querySelector('.x-brief').classList.contains('on'), camp:document.querySelector('.x-camp').classList.contains('on')}))));
await page.evaluate(()=>window.__G.game.start({skipIntro:true}));
await page.waitForTimeout(2000);
console.log('stateAfterSkip', await page.evaluate(()=>window.__G.game.state));
// evac hold: cut all
await page.evaluate(()=>{ window.__SX.god(); window.__SX.cutAll(); });
await page.waitForTimeout(2500);
console.log('hold', JSON.stringify(await page.evaluate(()=>({evac:window.__G.game.run.evacT, all:window.__G.game.run.allCut, obj:document.querySelector('.h-obj-t').textContent}))));
// force window
await page.evaluate(()=>{ window.__G.game.run.evacT=0.01; });
await page.waitForTimeout(1500);
console.log('open', JSON.stringify(await page.evaluate(()=>({evac:window.__G.game.run.evacT, obj:document.querySelector('.h-obj-t').textContent, markers:document.querySelectorAll('.h-wm').length}))));
// teleport to extraction
await page.evaluate(()=>{ const G=window.__G,e=G.level.extraction.pos; G.player.pos.set(e.x,e.y,e.z); });
await page.waitForTimeout(3000);
console.log('complete', await page.evaluate(()=>window.__G.game.state));
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-5).join('\n'));
await browser.close();
