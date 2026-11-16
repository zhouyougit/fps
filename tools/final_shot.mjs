
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
await page.goto('http://127.0.0.1:3311/versions/%E5%87%A0%E7%8C%AB_V5.html?q=low&noaudio=1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:180000});
await page.waitForTimeout(1200);
await page.evaluate(()=>window.__SX.unlockAll());
await page.screenshot({path:'tools/final_title.png',timeout:120000});
await page.evaluate(()=>window.__SX.openMissions());
await page.waitForTimeout(500);
await page.screenshot({path:'tools/final_missions.png',timeout:120000});
console.log(JSON.stringify(await page.evaluate(()=>({ready:window.__ready, state:window.__G.game.state, weapons:window.__G.weapon.list.length, err:(window.__errors||[]).slice(0,3)})), null, 0), errs.slice(0,2));
await browser.close();
