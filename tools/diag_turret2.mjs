
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:800,height:450} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
await page.waitForTimeout(800);
await page.evaluate(()=>{
  const G=window.__G,T=G.THREE;
  G.enemies.clear();
  G.player.pos.set(10,0,20); G.player.yaw=0; G.player.pitch=0; G.player.health=100; G.player.armor=0; G.player.invulnerable=false;
  window.__T=G.enemies.spawn('turret', new T.Vector3(10,0,14), {yaw:0,state:'alert'});
});
await page.waitForTimeout(4000);
console.log(JSON.stringify(await page.evaluate(()=>{
  const G=window.__G,t=window.__T;
  return {eye:G.player.eye.toArray().map(v=>+v.toFixed(2)), sensor:t.sensor.toArray().map(v=>+v.toFixed(2)), los:G.physics.lineOfSight(t.sensor,G.player.eye), tlos:t.los, mode:t.mode, es:t.es, pos:t.pos.toArray().map(v=>+v.toFixed(2)), hp:G.player.health};
}), null, 1));
await page.waitForTimeout(8000);
console.log(JSON.stringify(await page.evaluate(()=>{
  const G=window.__G,t=window.__T;
  return {mode:t.mode, es:t.es, hp:G.player.health, moved:+t.pos.distanceTo(new G.THREE.Vector3(10,0,14)).toFixed(2), sensor:t.sensor.toArray().map(v=>+v.toFixed(1))};
}), null, 1));
await browser.close();
