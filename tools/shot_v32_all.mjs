
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
const base='file:///Users/zhouyou/codex_workspace/fps/game.html';
async function ready(){ await page.waitForFunction(()=>window.__ready===true&&window.__SX,null,{timeout:420000}); await page.waitForTimeout(900); }
async function shot(name){ await page.waitForTimeout(1600); await page.screenshot({path:'versions/screens/'+name+'.png',timeout:120000}); console.log('shot',name); }
await page.goto(base+'?q=low&noaudio=1',{waitUntil:'load',timeout:240000});
await ready();
await page.waitForTimeout(1200);
await page.screenshot({path:'versions/screens/v32_title.png',timeout:120000});
console.log('shot title');
await page.goto(base+'?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:240000});
await ready();
await page.evaluate(()=>{ const G=window.__G; window.__SX.applyMission(0); G.game.start({skipIntro:true}); G.player.pos.set(-19,0,9); G.player.yaw=0.3; G.player.pitch=0.02; });
await shot('v32_harbor');
await page.evaluate(()=>{ const G=window.__G; window.__SX.applyMission(3); G.game.start({skipIntro:true}); G.player.pos.set(-20,0,10); G.player.yaw=1.1; G.player.pitch=0.02; });
await shot('v32_depot');
await page.evaluate(()=>{ const G=window.__G; window.__SX.applyMission(4); G.game.start({skipIntro:true}); G.player.pos.set(0,0.3,-5.5); G.player.yaw=Math.PI; G.player.pitch=0.02; });
await shot('v32_ship');
await page.evaluate(()=>{ const G=window.__G; window.__SX.switchMap('core'); G.player.pos.set(0,0.42,8); G.player.yaw=Math.PI; G.player.pitch=0.02; G.player.enabled=true; });
await shot('v32_core');
await page.evaluate(()=>{ const G=window.__G; window.__SX.applyMission(2); G.game.start({skipIntro:true}); window.__SX.god(); window.__SX.cutAll(); });
await page.waitForTimeout(5000);
await page.evaluate(()=>{ const G=window.__G; const b=G.enemies.list.find(e=>e.boss); if(b){ G.player.pos.set(b.pos.x,0,b.pos.z+10); G.player.yaw=Math.PI; } });
await shot('v32_boss');
console.log(JSON.stringify(await page.evaluate(()=>({errs:(window.__errors||[]).slice(0,3), state:window.__G.game.state, map:window.__SX.mapId(), pickups:window.__SX.S.pickups.length, loop:window.__SX_LOOP.stats()}))));
console.log('pageerrs', errs.slice(0,3));
await browser.close();
process.exit(0);
