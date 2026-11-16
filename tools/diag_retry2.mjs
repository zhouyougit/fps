
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1000,height:560} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(1200);
await page.evaluate(()=>{ window.__G.player.damage(999,null); });
for(let i=0;i<12;i++){ await page.waitForTimeout(1500); const vis=await page.evaluate(()=>getComputedStyle(document.querySelector('.m-screen[data-s="dead"]')).display!=='none'); if(vis) break; }
const box=await page.locator('[data-act="retry"]').boundingBox();
console.log('box', JSON.stringify(box));
if(box) await page.mouse.click(box.x+box.width/2, box.y+box.height/2);
await page.waitForTimeout(400);
console.log('first', JSON.stringify(await page.evaluate(()=>({text:document.querySelector('[data-act="retry"]').textContent, state:window.__G.game.state, confirm:document.querySelector('[data-act="retry"]').dataset.confirm}))));
if(box) await page.mouse.click(box.x+box.width/2, box.y+box.height/2);
await page.waitForTimeout(1200);
console.log('second', JSON.stringify(await page.evaluate(()=>({text:document.querySelector('[data-act="retry"]').textContent, state:window.__G.game.state}))));
await browser.close();
