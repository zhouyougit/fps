
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:1024,height:576} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('http://127.0.0.1:3311/game.html?shot=1&autostart=1&q=low&noaudio=1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:180000});
await page.waitForTimeout(1200);
console.log('boot', JSON.stringify(await page.evaluate(()=>({fatal:window.__fatal,err:(window.__errors||[]).slice(0,5),w:window.__G.weapon.name,slots:window.__G.weapon.list.map(x=>[x.name,x.ammo,x.magSize]),ext:!!window.__SX}))));
await page.screenshot({path:'tools/v2_rifle.png',timeout:120000});
await page.evaluate(()=>window.__G.weapon.select(1));
await page.waitForTimeout(900);
await page.screenshot({path:'tools/v2_shotgun.png',timeout:120000});
console.log('shotgun', JSON.stringify(await page.evaluate(()=>({name:window.__G.weapon.name,ammo:window.__G.weapon.ammo,reserve:window.__G.weapon.reserve,mag:window.__G.weapon.magSize,info:window.__G.weapon.info,err:(window.__errors||[]).slice(0,5)}))));
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-10).join('\n'));
await browser.close();
