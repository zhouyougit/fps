
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page=await browser.newPage({ viewport:{width:1280,height:720} });
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:240000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:420000});
await page.evaluate(()=>{ const G=window.__G; window.__SX.applyMission(3); G.game.start({skipIntro:true}); G.player.pos.set(-28,0.03,0); G.player.yaw=-1.57; G.player.pitch=0.02; });
await new Promise(r=>setTimeout(r,2600));
await page.screenshot({path:'tools/v32_depot_hall.png',timeout:120000});
await page.evaluate(()=>{ const G=window.__G; G.player.pos.set(0,0.03,17); G.player.yaw=0; G.player.pitch=0.02; });
await new Promise(r=>setTimeout(r,1000));
await page.screenshot({path:'tools/v32_depot_dock.png',timeout:120000});
console.log(JSON.stringify(await page.evaluate(()=>({map:window.__SX.mapId(),boxes:window.__G.physics.boxes.length,valid:window.__SX.validateObjectives().every(x=>x.ok),err:window.__errors&&window.__errors.length}))));
await browser.close();
