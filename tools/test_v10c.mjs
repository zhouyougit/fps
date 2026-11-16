
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
await page.waitForTimeout(1000);
console.log('spawn', JSON.stringify(await page.evaluate(()=>{
  const G=window.__G,T=G.THREE;
  G.enemies.clear();
  const t=G.enemies.spawn('turret', new T.Vector3(-2,0,12), {yaw:0});
  const h=G.enemies.spawn('heavy', new T.Vector3(10,0,20), {yaw:0});
  return {turret:{hp:t.hp,fixed:t.fixed,leg:+t.rig.bones.abdFL.scale.x.toFixed(2),mesh:!!t.shieldMesh}, heavy:{hp:h.hp,shield:h.shieldHp}, pool:G.enemies.TUNE.poolHounds};
})));
console.log('shield', JSON.stringify(await page.evaluate(()=>{
  const G=window.__G,T=G.THREE;
  G.enemies.clear();
  const h=G.enemies.spawn('heavy', new T.Vector3(-2,0,12), {yaw:0});
  const front=new T.Vector3(-2,1.6,18), dirF=new T.Vector3(0,-1.1,-6).normalize();
  const back=new T.Vector3(-2,1.6,6), dirB=new T.Vector3(0,-1.1,6).normalize();
  const hp0=h.hp;
  const s1=G.combat.playerShot(front,dirF,{damage:20,range:50});
  const hp1=h.hp, sh1=h.shieldHp;
  const s2=G.combat.playerShot(back,dirB,{damage:20,range:50});
  const hp2=h.hp, sh2=h.shieldHp;
  for(let i=0;i<20;i++) G.combat.playerShot(front,dirF,{damage:20,range:50});
  return {frontPart:s1&&s1.part, frontLoss:+(hp0-hp1).toFixed(2), sh1, backPart:s2&&s2.part, backLoss:+(hp1-hp2).toFixed(2), sh2, shieldNow:h.shieldHp, mesh:h.shieldMesh&&h.shieldMesh.visible};
})));
await page.screenshot({path:'tools/v10_heavy.png',timeout:120000});
// turret live fire
await page.evaluate(()=>{
  const G=window.__G,T=G.THREE;
  G.enemies.clear();
  G.player.pos.set(-2,0,18); G.player.yaw=0; G.player.pitch=0; G.player.health=100; G.player.armor=0; G.player.invulnerable=false;
  const t=G.enemies.spawn('turret', new T.Vector3(-2,0,12), {yaw:Math.PI, state:'alert'});
  window.__T0=t.pos.clone();
});
await page.waitForTimeout(12000);
console.log('turretAI', JSON.stringify(await page.evaluate(()=>{
  const G=window.__G,t=G.enemies.list.find(e=>e.alive&&e.variant==='turret');
  return {exists:!!t, es:t&&t.es, mode:t&&t.mode, hp:G.player.health, moved:t?+t.pos.distanceTo(window.__T0).toFixed(2):null, shots:G.combat.stats.shots};
})));
await page.screenshot({path:'tools/v10_turret.png',timeout:120000});
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-6).join('\n'));
await browser.close();
