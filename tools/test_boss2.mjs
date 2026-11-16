
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:1024,height:576} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('http://127.0.0.1:3311/game.html?q=low&noaudio=1&autostart=1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:180000});
await page.waitForTimeout(1500);
await page.evaluate(()=>{ window.__SX.launchFast(2); });
await page.waitForTimeout(2500);
await page.evaluate(()=>{ window.__SX.god(); window.__SX.cutAll(); });
await page.waitForTimeout(4000);
await page.evaluate(()=>{
  const G=window.__G; const b=G.enemies.list.find(e=>e.boss);
  if(b){ G.player.pos.set(b.pos.x, 0, b.pos.z+9); G.player.yaw = 0; G.player.pitch = 0.05; }
});
await page.waitForTimeout(2500);
await page.screenshot({path:'tools/v4_boss2.png',timeout:120000});
console.log('boss', JSON.stringify(await page.evaluate(()=>{
  const G=window.__G,b=G.enemies.list.find(e=>e.boss);
  return {state:G.game.state, alive:b&&b.alive, hp:b&&b.hp, pos:b&&b.pos.toArray().map(v=>+v.toFixed(1)), bossAlive:G.game.run.bossAlive, bar:document.querySelector('.x-boss')&&document.querySelector('.x-boss').className, err:(window.__errors||[]).slice(0,4)};
})));
// drone test
console.log('drone', JSON.stringify(await page.evaluate(async ()=>{
  const G=window.__G,T=G.THREE;
  const before=G.player.health;
  const e=G.enemies.spawn('drone', new T.Vector3(G.player.pos.x, G.player.pos.y+5, G.player.pos.z-12), {state:'alert'});
  await new Promise(r=>setTimeout(r,6000));
  return {spawned:!!e, alive:e&&e.alive, variant:e&&e.variant, hpBefore:before, hpAfter:G.player.health, dist:e?+e.pos.distanceTo(G.player.pos).toFixed(1):null};
})));
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-6).join('\n'));
await browser.close();
