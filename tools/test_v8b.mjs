
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
await page.waitForTimeout(1200);
console.log(JSON.stringify(await page.evaluate(()=>{
  const S=window.__SX,G=window.__G,T=G.THREE;
  S.god(); G.player.invulnerable=false;
  const st=S.armorySet('pac9','muzzle','supp');
  G.player.pos.set(-19,0,9); G.player.yaw=0; G.player.pitch=0;
  G.enemies.clear();
  const e=G.enemies.spawn('hound', new T.Vector3(-19,0,4), {state:'alert', passive:true});
  window.__FIRED=[];
  G.events.on('weapon:fire', ev=>window.__FIRED.push({radius:ev.radius, weapon:ev.weapon}));
  return {st, hp:e.hp, muzzle:!!G.weapon.list[0].__sxMuzzle, visible:G.weapon.list[0].__sxMuzzle&&G.weapon.list[0].__sxMuzzle.visible};
})));
await page.waitForTimeout(1500);
await page.screenshot({path:'tools/v8_supp.png',timeout:120000});
// fire once at enemy
await page.keyboard.down('Enter'); await page.waitForTimeout(1500); await page.keyboard.up('Enter');
await page.waitForTimeout(1500);
console.log(JSON.stringify(await page.evaluate(()=>({
  fired:window.__FIRED.slice(0,3),
  hp:window.__G.enemies.list.filter(e=>e.alive).map(e=>e.hp),
  shots:window.__G.combat.stats.shots,
  err:(window.__errors||[]).slice(0,3)
}))));
// equip extended mag and check UI stat
await page.evaluate(()=>window.__SX.armorySet('pac9','mag','ext'));
await page.waitForTimeout(300);
console.log('mag', JSON.stringify(await page.evaluate(()=>({
  magSize:window.__G.weapon.list[0].magSize, ammo:window.__G.weapon.list[0].ammo, stat:window.__SX.armoryStats('pac9')
}))));
await browser.close();
