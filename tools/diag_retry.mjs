
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(1000);
await page.evaluate(()=>{ window.__G.player.damage(999,null); });
await page.waitForTimeout(1500);
console.log(JSON.stringify(await page.evaluate(()=>{
  const b=document.querySelector('[data-act="retry"]');
  const r=b&&b.getBoundingClientRect();
  const scr=b&&b.closest('.m-screen');
  const cs=b&&getComputedStyle(b);
  return {state:window.__G.game.state, locked:!!document.pointerLockElement, text:b&&b.textContent, screen:scr&&scr.dataset.s, screenDisplay:scr&&getComputedStyle(scr).display, rect:r&&{x:r.x,y:r.y,w:r.width,h:r.height}, display:cs&&cs.display, pe:cs&&cs.pointerEvents, at:document.elementFromPoint(r?r.x+r.width/2:0,r?r.y+r.height/2:0)?.outerHTML.slice(0,120)};
}),null,1));
const rb=await page.locator('[data-act="retry"]').boundingBox();
if(rb) await page.mouse.click(rb.x+rb.width/2, rb.y+rb.height/2);
await page.waitForTimeout(400);
console.log('after mouse', JSON.stringify(await page.evaluate(()=>({text:document.querySelector('[data-act="retry"]').textContent, state:window.__G.game.state, confirm:document.querySelector('[data-act="retry"]').dataset.confirm}))));
await page.evaluate(()=>document.querySelector('[data-act="retry"]').click());
await page.waitForTimeout(300);
console.log('after dom', JSON.stringify(await page.evaluate(()=>({text:document.querySelector('[data-act="retry"]').textContent, state:window.__G.game.state, confirm:document.querySelector('[data-act="retry"]').dataset.confirm}))));
await browser.close();
