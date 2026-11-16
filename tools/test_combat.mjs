
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:1024,height:576} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('http://127.0.0.1:3311/game.html?shot=1&autostart=1&q=low&noaudio=1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
await page.waitForTimeout(1200);
const setup = await page.evaluate(()=>{
  const G=window.__G,S=window.__SX,T=G.THREE;
  S.god(); G.weapon.select(1);
  G.player.pos.set(-10,0,10); G.player.vel.set(0,0,0); G.player.yaw=0; G.player.pitch=0;
  G.enemies.clear();
  const e=G.enemies.spawn('hound', new T.Vector3(-10,0,4), {state:'alert', target:G.player.pos});
  return {spawned:!!e, hp:e&&e.hp};
});
console.log('setup', JSON.stringify(setup));
await page.waitForTimeout(4000);
await page.keyboard.down('Enter');
await page.waitForTimeout(1800);
await page.keyboard.up('Enter');
await page.waitForTimeout(1500);
const r1 = await page.evaluate(()=>({hp:window.__G.enemies.list.filter(e=>e.alive).map(e=>e.hp), kills:window.__G.combat.stats.kills, shots:window.__G.combat.stats.shots, ammo:window.__G.weapon.ammo}));
console.log('afterFire', JSON.stringify(r1));
await page.screenshot({path:'tools/v2_combat.png',timeout:120000});
// pickup test: teleport to medkit spot and damage first
const r2 = await page.evaluate(async ()=>{
  const G=window.__G,S=window.__SX;
  const p=S.S.pickups.find(p=>p.type==='medkit'&&!p.taken);
  G.player.health=40; G.player.armor=10;
  G.player.pos.set(p.x, p.y, p.z);
  await new Promise(r=>setTimeout(r,1200));
  return {hp:G.player.health, armor:G.player.armor, taken:p.taken, pickupsLeft:S.S.pickups.filter(p=>!p.taken).length};
});
console.log('pickup', JSON.stringify(r2));
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-6).join('\n'));
await browser.close();
