
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1000,height:560} });
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
await page.goto('file:///Users/zhouyou/codex_workspace/fps/versions/%E5%87%A0%E7%8C%AB_V6.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:180000});
await page.waitForTimeout(1200);
console.log(JSON.stringify(await page.evaluate(()=>({ready:window.__ready,fatal:window.__fatal,profile:window.__SX_PROFILE,weapons:window.__G.weapon.list.length,scan:!!window.__SX.scan,state:window.__G.game.state,err:(window.__errors||[]).slice(0,3)})), null, 0), errs.slice(0,2));
await browser.close();
