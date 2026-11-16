
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
await page.goto('file:///Users/zhouyou/codex_workspace/fps/versions/%E5%87%A0%E7%8C%AB_V8.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:180000});
await page.waitForTimeout(1200);
console.log('boot', JSON.stringify(await page.evaluate(()=>({ready:window.__ready,fatal:window.__fatal,weapons:window.__G.weapon.list.length,armory:!!window.__SX.armory,profile:window.__SX_PROFILE,err:(window.__errors||[]).slice(0,3)}))), errs.slice(0,2));
// pause then open armory via pause button
await page.keyboard.press('Escape');
await page.waitForTimeout(1200);
const paused = await page.evaluate(()=>window.__G.game.state);
const btn = await page.locator('.m-screen[data-s="paused"] [data-x="armory"]').boundingBox();
if (btn) await page.mouse.click(btn.x+btn.width/2, btn.y+btn.height/2);
await page.waitForTimeout(500);
console.log('armoryFromPause', JSON.stringify(await page.evaluate(()=>({paused:window.__G.game.state, open:document.querySelector('.x-armory').classList.contains('on'), err:(window.__errors||[]).slice(0,3)}))), 'pausedBefore='+paused);
await browser.close();
