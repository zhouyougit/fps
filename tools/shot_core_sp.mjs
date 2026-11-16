
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page=await browser.newPage({ viewport:{width:1280,height:720} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(700);
await page.evaluate(()=>{ const G=window.__G; window.__SX.switchMap('core'); G.game.start({skipIntro:true}); G.player.pos.set(0,0.4,9); G.player.yaw=0; G.player.pitch=0; });
await page.waitForTimeout(2500);
console.log(JSON.stringify(await page.evaluate(()=>({map:window.__SX.mapId(), pos:window.__G.player.pos.toArray().map(v=>+v.toFixed(1)), light:window.__G.render.sun.intensity, fog:window.__G.scene.fog&&window.__G.scene.fog.color.getHexString(), boxes:window.__G.physics.boxes.length}))));
await page.screenshot({path:'tools/v25_core_sp.png',timeout:120000});
await browser.close();
