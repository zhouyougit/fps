
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:1100,height:700} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('http://127.0.0.1:3311/game.html?show=weapon&wmodel=shotgun&wpose=side&q=low&noaudio=1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:180000});
await page.waitForTimeout(2000);
console.log(JSON.stringify(await page.evaluate(()=>({fatal:window.__fatal,err:(window.__errors||[]).slice(0,4),info:window.__G.weapon&&window.__G.weapon.info}))));
await page.screenshot({path:'tools/shot_side.png',timeout:120000});
await page.goto('http://127.0.0.1:3311/game.html?show=weapon&wmodel=shotgun&wpose=hands&q=low&noaudio=1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
await page.waitForTimeout(1500);
await page.screenshot({path:'tools/shot_hands.png',timeout:120000});
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-6).join('\n'));
await browser.close();
