
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page=await browser.newPage({ viewport:{width:1280,height:720} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(700);
await page.evaluate(()=>{ window.__MP.open(); document.querySelector('[data-mp-map]').value='ship'; });
await page.waitForTimeout(400);
await page.screenshot({path:'tools/v21_lobby_maps.png',timeout:120000});
console.log(JSON.stringify(await page.evaluate(()=>({map:document.querySelector('[data-mp-map]').value, options:[...document.querySelectorAll('[data-mp-map] option')].map(o=>o.textContent)}))));
await browser.close();
