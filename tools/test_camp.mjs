
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('http://127.0.0.1:3311/game.html?q=low&noaudio=1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:180000});
await page.waitForTimeout(1500);
console.log('boot', JSON.stringify(await page.evaluate(()=>({fatal:window.__fatal,state:window.__G.game.state, err:(window.__errors||[]).slice(0,6), obj:window.__G.level.objectives.map(o=>[o.id,o.label]), ext:!!window.__SX, mission:window.__G.game.currentMission&&window.__G.game.currentMission.id}))));
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-8).join('\n'));
await page.screenshot({path:'tools/v3_title.png',timeout:120000});
// open mission screen
const btn = await page.$('[data-x="campaign"]');
if (btn) { await btn.click(); await page.waitForTimeout(500); }
await page.screenshot({path:'tools/v3_missions.png',timeout:120000});
console.log('overlay', JSON.stringify(await page.evaluate(()=>({on:document.querySelector('.x-camp')&&document.querySelector('.x-camp').classList.contains('on'), cards:document.querySelectorAll('.x-mcard').length}))));
await browser.close();
