
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:1024,height:576} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('http://127.0.0.1:3311/game.html?q=low&noaudio=1&autostart=1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:180000});
await page.waitForTimeout(1200);
await page.evaluate(()=>{ window.__SX.launchFast(2); });
await page.waitForTimeout(1800);
await page.evaluate(()=>{ window.__SX.god(); window.__SX.cutAll(); });
await page.waitForTimeout(4500);
await page.evaluate(()=>{
  const G=window.__G; const b=G.enemies.list.find(e=>e.boss);
  if(b){ G.player.pos.set(b.pos.x-1, 0, b.pos.z+5.5); G.player.yaw=0; G.player.pitch=0.02; }
});
await page.waitForTimeout(1200);
await page.screenshot({path:'tools/v4_boss_close.png',timeout:120000});
console.log('scale', JSON.stringify(await page.evaluate(()=>{
  const b=window.__G.enemies.list.find(e=>e.boss);
  return b?{pos:b.pos.toArray().map(v=>+v.toFixed(1)), scale:b.rig.group.scale.toArray(), hp:b.hp, flash:b.flare, mode:b.mode, es:b.es}:null;
})));
// drone close test with manual stepping
console.log('drone', JSON.stringify(await page.evaluate(async ()=>{
  const G=window.__G,T=G.THREE;
  const before=G.player.health;
  const e=G.enemies.spawn('drone', new T.Vector3(G.player.pos.x, G.player.pos.y+2.2, G.player.pos.z-4.5), {state:'alert'});
  const t0=performance.now();
  for(let i=0;i<200;i++){ e._update(0.05); if(!e.alive) break; await new Promise(r=>setTimeout(r,0)); }
  return {alive:e.alive, retired:!e.active, hpBefore:before, hpAfter:G.player.health, dist:+e.pos.distanceTo(G.player.pos).toFixed(2)};
})));
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-5).join('\n'));
await browser.close();
