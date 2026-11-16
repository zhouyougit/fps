
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
await page.waitForTimeout(1000);
console.log('variants', JSON.stringify(await page.evaluate(()=>{
  const G=window.__G,T=G.THREE;
  G.enemies.clear();
  const m=G.enemies.spawn('marksman', new T.Vector3(-19,0,-16), {yaw:0, state:'alert', passive:true});
  const h=G.enemies.spawn('heavy', new T.Vector3(-19,0,4), {yaw:0});
  return {
    marksman:{hp:m.hp,rMin:m.rangeMin,rMax:m.rangeMax,laser:m.laser,dmg:m.shotDamage,burst:m.burstCount,variant:m.variant},
    heavy:{hp:h.hp,shield:h.shieldHp,max:h.maxShield,scale:+h.rig.group.scale.x.toFixed(2),mesh:!!(h.shieldMesh&&h.shieldMesh.visible),variant:h.variant}
  };
})));
console.log('shield', JSON.stringify(await page.evaluate(()=>{
  const G=window.__G,T=G.THREE;
  G.enemies.clear();
  const h=G.enemies.spawn('heavy', new T.Vector3(-2,0,12), {yaw:0});
  const front=new T.Vector3(-2,1.6,18), dirF=new T.Vector3(0,-0.85,-6).normalize();
  const back=new T.Vector3(-2,1.6,6), dirB=new T.Vector3(0,-0.85,6).normalize();
  const hp0=h.hp;
  const s1=G.combat.playerShot(front,dirF,{damage:20,range:50});
  const hp1=h.hp, sh1=h.shieldHp;
  const s2=G.combat.playerShot(back,dirB,{damage:20,range:50});
  const hp2=h.hp, sh2=h.shieldHp;
  for(let i=0;i<20;i++) G.combat.playerShot(front,dirF,{damage:20,range:50});
  return {hp0, frontHit:s1&&s1.surface, frontLoss:+(hp0-hp1).toFixed(2), shieldAfterFront:sh1, backHit:s2&&s2.surface, backLoss:+(hp1-hp2).toFixed(2), shieldAfterBack:sh2, shieldNow:h.shieldHp, meshVisible:h.shieldMesh&&h.shieldMesh.visible};
})));
await page.waitForTimeout(500);
await page.screenshot({path:'tools/v10_heavy.png',timeout:120000});
// wave queue composition
console.log('waves', JSON.stringify(await page.evaluate(()=>{
  const G=window.__G;
  G.game.flow.waves=[{gull:0,hound:0,marksman:2,heavy:1}];
  G.game.debugCut();
  return G.game.run.queue.map(q=>q.type);
})));
// kill feed names
console.log('feed', JSON.stringify(await page.evaluate(()=>{
  const G=window.__G,T=G.THREE;
  G.enemies.clear();
  const a=G.enemies.spawn('marksman', new T.Vector3(-2,0,12), {yaw:0});
  const b=G.enemies.spawn('heavy', new T.Vector3(-2,0,14), {yaw:0});
  a.damage(9999,a.pos,new T.Vector3(0,0,1),'body');
  b.damage(9999,b.pos,new T.Vector3(0,0,1),'body');
  return [...document.querySelectorAll('.h-fl')].map(x=>x.textContent);
})));
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-5).join('\n'));
await browser.close();
