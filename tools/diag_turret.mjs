
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:800,height:450} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
await page.waitForTimeout(800);
console.log(JSON.stringify(await page.evaluate(()=>{
  const G=window.__G,T=G.THREE;
  const spots=[[-2,18],[-2,12],[10,26],[10,20],[10,14],[-30,12],[-30,6]];
  const out=spots.map(([x,z])=>({x,z,gh:+G.physics.groundHeight(x,z,12).toFixed(2),walk:G.physics.nav.isWalkable(x,z)}));
  G.enemies.clear();
  G.player.pos.set(-2,0,18); G.player.yaw=0; G.player.pitch=0;
  const t=G.enemies.spawn('turret', new T.Vector3(-2,0,12), {yaw:0,state:'alert'});
  const los=G.physics.lineOfSight(t.sensor, G.player.eye);
  const w=G.physics.raycast(t.sensor, new T.Vector3(0,0,1), 10);
  return {spots, sensor:t.sensor.toArray().map(v=>+v.toFixed(2)), eye:G.player.eye.toArray().map(v=>+v.toFixed(2)), los, wall:w&&{d:+w.dist.toFixed(2),s:w.surface}, turretPos:t.pos.toArray().map(v=>+v.toFixed(2))};
}), null, 1).slice(0,4000));
await browser.close();
