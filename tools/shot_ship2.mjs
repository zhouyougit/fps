
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page=await browser.newPage({ viewport:{width:1280,height:720} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(700);
await page.evaluate(()=>{ const G=window.__G; window.__SX.applyMission(4); G.game.start({skipIntro:true}); G.player.pos.set(0,0.32,-6.6); G.player.yaw=Math.PI; G.player.pitch=0.02; });
await page.waitForTimeout(2500);
await page.screenshot({path:'tools/v18_ship_stern.png',timeout:120000});
await page.evaluate(()=>{ const G=window.__G; G.player.pos.set(-20,0.32,2); G.player.yaw=-1.2; G.player.pitch=0.03; });
await page.waitForTimeout(1200);
await page.screenshot({path:'tools/v18_ship_side.png',timeout:120000});
await browser.close();
