
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:1024,height:576} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('http://127.0.0.1:3311/game.html?q=low&noaudio=1&autostart=1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:180000});
await page.waitForTimeout(2500);
// launch mission 3 and skip ahead
await page.evaluate(()=>window.__SX.launch(2));
await page.waitForTimeout(5000);
await page.evaluate(()=>{ window.__SX.god(); window.__SX.cutAll(); });
await page.waitForTimeout(5000);
const boss1 = await page.evaluate(()=>{
  const G=window.__G;
  const b=G.enemies.list.find(e=>e.boss);
  return {state:G.game.state, bossAlive:G.game.run.bossAlive, boss: b?{hp:b.hp,maxHp:b.maxHp,pos:b.pos.toArray().map(v=>+v.toFixed(1)),phase:b.bossPhase}:null, err:(window.__errors||[]).slice(0,6)};
});
console.log('boss1', JSON.stringify(boss1));
await page.screenshot({path:'tools/v4_boss.png',timeout:120000});
// damage boss to phase 2
await page.evaluate(()=>{
  const G=window.__G; const b=G.enemies.list.find(e=>e.boss);
  if(b){ b.hp = b.maxHp*0.3; }
});
await page.waitForTimeout(4000);
console.log('boss2', JSON.stringify(await page.evaluate(()=>{
  const G=window.__G; const b=G.enemies.list.find(e=>e.boss);
  return {phase:b&&b.bossPhase, hp:b&&b.hp, drones:G.enemies.list.filter(e=>e.alive&&e.variant==='drone').length, bar:document.querySelector('.x-boss')&&document.querySelector('.x-boss').className, err:(window.__errors||[]).slice(0,6)};
})));
// kill boss
await page.evaluate(()=>{
  const G=window.__G; const b=G.enemies.list.find(e=>e.boss);
  if(b) b.damage(9999, b.pos, new G.THREE.Vector3(0,0,1), 'weak');
});
await page.waitForTimeout(4000);
console.log('after', JSON.stringify(await page.evaluate(()=>({bossAlive:window.__G.game.run.bossAlive, obj:document.querySelector('.h-obj-t')&&document.querySelector('.h-obj-t').textContent, bar:document.querySelector('.x-boss')&&document.querySelector('.x-boss').className, kills:window.__G.combat.stats.kills}))));
await page.screenshot({path:'tools/v4_boss_dead.png',timeout:120000});
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-10).join('\n'));
await browser.close();
