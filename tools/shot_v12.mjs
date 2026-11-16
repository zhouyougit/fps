
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(1000);
await page.evaluate(()=>{ const G=window.__G; window.__SX.applyMission(1); G.game.start({skipIntro:true}); });
await page.waitForTimeout(3500);
await page.screenshot({path:'tools/v12_interior.png',timeout:120000});
console.log(JSON.stringify(await page.evaluate(()=>({pos:window.__G.player.pos.toArray().map(v=>+v.toFixed(1)), yaw:+window.__G.player.yaw.toFixed(2), env:window.__SX.environment()}))));
await browser.close();
