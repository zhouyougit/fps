
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
await page.waitForTimeout(1000);
async function click(sel){ const b=await page.locator(sel).first().boundingBox(); if(!b) return false; await page.mouse.click(b.x+b.width/2,b.y+b.height/2); return true; }
await page.evaluate(()=>window.__SX.unlockAll());
await click('[data-x="campaign"]'); await page.waitForTimeout(300);
await click('.x-train-card'); await page.waitForTimeout(200);
await click('.x-camp-actions [data-x="go"]'); await page.waitForTimeout(2000);
await page.evaluate(()=>{ window.__SX.S.training.t=0.01; });
await page.waitForTimeout(1200);
await page.evaluate(()=>{
  window.__EV=[];
  const btn=document.querySelector('.x-tr-actions [data-x="again"]');
  for(const t of ['pointerdown','mousedown','pointerup','mouseup','click']){
    btn.addEventListener(t, e=>{ window.__EV.push(t+'@btn'); }, true);
    document.addEventListener(t, e=>{ window.__EV.push(t+'@doc:'+(e.target.tagName||'')+'.'+(e.target.className||'')); }, true);
  }
});
const b=await page.locator('.x-tr-actions [data-x="again"]').boundingBox();
await page.mouse.move(b.x+b.width/2, b.y+b.height/2);
await page.mouse.down();
await page.waitForTimeout(200);
await page.mouse.up();
await page.waitForTimeout(500);
console.log('events', JSON.stringify(await page.evaluate(()=>window.__EV)));
console.log('state', JSON.stringify(await page.evaluate(()=>({again:window.__TRAIN_AGAIN_CLICK||0, launches:window.__TRAIN_LAUNCH||0, state:window.__G.game.state}))));
await browser.close();
