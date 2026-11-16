
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:900,height:600} });
await page.goto('http://127.0.0.1:3311/game.html?show=weapon&q=low&noaudio=1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:180000});
await page.waitForTimeout(2500);
console.log(JSON.stringify(await page.evaluate(()=>({fatal:window.__fatal, cam: window.__G.camera.position.toArray(), info: window.__G.weapon && window.__G.weapon.info}))));
await page.screenshot({path:'tools/rifle_show.png',timeout:120000});
await browser.close();
