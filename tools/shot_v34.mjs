
import { chromium } from 'playwright';
const b = await chromium.launch({ headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const p = await b.newPage({ viewport:{width:1280,height:720} });
await p.goto('file:///Users/zhouyou/codex_workspace/fps/versions/几猫_V34.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:240000});
await p.waitForFunction(()=>window.__ready===true&&window.__SX,null,{timeout:420000});
await p.waitForTimeout(1200);
await p.evaluate(()=>{ const G=window.__G; window.__SX.applyMission(6); G.game.start({skipIntro:true}); G.player.pos.set(24,0,18); G.player.yaw=2.4; G.player.pitch=0.02; G.enemies.spawn('siege',new G.THREE.Vector3(18,0,8),{}); G.enemies.spawn('scout',new G.THREE.Vector3(22,4,12),{}); });
await p.waitForTimeout(2500);
await p.screenshot({path:'versions/screens/v34_m7.png',timeout:120000});
await p.evaluate(()=>{ const G=window.__G; window.__SX.applyMission(7); G.game.start({skipIntro:true}); G.player.pos.set(0,0.42,9.6); G.player.yaw=Math.PI; window.__SX.cutAll(); });
await p.waitForTimeout(4000);
await p.screenshot({path:'versions/screens/v34_m8_core.png',timeout:120000});
console.log(JSON.stringify(await p.evaluate(()=>({state:window.__G.game.state,mission:window.__G.game.currentMission&&window.__G.game.currentMission.id,map:window.__SX.mapId(),boss:!!window.__G.game.run.bossAlive,err:(window.__errors||[]).slice(0,3)}))));
try{ await Promise.race([b.close(),new Promise(r=>setTimeout(r,3000))]); }catch(e){}
process.exit(0);
