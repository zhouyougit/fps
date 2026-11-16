
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:640,height:360} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('http://127.0.0.1:3311/game.html?q=low&noaudio=1&autostart=1',{waitUntil:'load',timeout:120000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:120000});
await page.waitForTimeout(2000);
console.log(JSON.stringify(await page.evaluate(()=>({
  w:window.__G.weapon && {name:window.__G.weapon.name, list:!!window.__G.weapon.list, stub:window.__G.weapon.stub},
  errors:(window.__errors||[]).slice(0,6), fatal:window.__fatal
}))));
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-12).join('\n'));
await browser.close();
