
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:640,height:360} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('http://127.0.0.1:3311/game.html?q=low&noaudio=1&autostart=1',{waitUntil:'load',timeout:120000});
await page.waitForTimeout(25000);
const st = await page.evaluate(()=>({ready:window.__ready, fatal:window.__fatal, errors:(window.__errors||[]).slice(0,6), hasG:!!window.__G, weapon:window.__G&&window.__G.weapon&&window.__G.weapon.name}));
console.log(JSON.stringify(st));
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-12).join('\n'));
await browser.close();
