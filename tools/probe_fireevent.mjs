
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page=await browser.newPage({ viewport:{width:640,height:360} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(600);
await page.evaluate(()=>{ window.__F=[]; window.__G.events.on('weapon:fire', e=>window.__F.push({keys:Object.keys(e), e:e})); });
await page.keyboard.down('Enter'); await page.waitForTimeout(1200); await page.keyboard.up('Enter');
console.log(JSON.stringify(await page.evaluate(()=>({n:window.__F.length, first:window.__F[0]&&{keys:window.__F[0].keys, dir:window.__F[0].e.dir, origin:window.__F[0].e.origin, weapon:window.__F[0].e.weapon}})),null,1).slice(0,4000));
await browser.close();
