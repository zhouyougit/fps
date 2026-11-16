
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
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
console.log('counts', JSON.stringify(await page.evaluate(()=>({
  overlays:document.querySelectorAll('.x-train-result').length,
  onCount:document.querySelectorAll('.x-train-result.on').length,
  launches:window.__TRAIN_LAUNCH||0,
  againClicks:window.__TRAIN_AGAIN_CLICK||0
}))));
await page.locator('.x-tr-actions [data-x="again"]').click({force:true});
await page.waitForTimeout(1500);
console.log('after', JSON.stringify(await page.evaluate(()=>({
  launches:window.__TRAIN_LAUNCH||0, againClicks:window.__TRAIN_AGAIN_CLICK||0,
  state:window.__G.game.state, active:window.__SX.S.training&&window.__SX.S.training.active,
  result:document.querySelector('.x-train-result').className, err:(window.__errors||[]).slice(0,3)
}))));
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-5).join('\n'));
await browser.close();
