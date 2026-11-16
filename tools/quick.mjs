
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:800,height:450} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('http://127.0.0.1:3311/game.html?shot=1&autostart=1&q=low&noaudio=1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:180000});
await page.waitForTimeout(1500);
console.log(JSON.stringify(await page.evaluate(()=>({fatal:window.__fatal,w:window.__G.weapon.name,ammo:window.__G.weapon.ammo,tris:window.__G.weapon.info.tris,err:window.__errors.slice(0,4),ext:!!window.__SX}))));
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-8).join('\n'));
await browser.close();
