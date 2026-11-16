
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:800,height:450} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
await page.waitForTimeout(1000);
console.log(JSON.stringify(await page.evaluate(()=>{
  const G=window.__G,T=G.THREE;
  G.enemies.clear();
  const h=G.enemies.spawn('heavy', new T.Vector3(22,0,6), {yaw:0});
  const front=new T.Vector3(22,1.6,12), dirF=new T.Vector3(0,-0.85,-6).normalize();
  const back=new T.Vector3(22,1.6,0), dirB=new T.Vector3(0,-0.85,6).normalize();
  const rcF=G.enemies.raycast(front,dirF,50), wF=G.physics.raycast(front,dirF,50);
  const rcB=G.enemies.raycast(back,dirB,50), wB=G.physics.raycast(back,dirB,50);
  const hp0=h.hp;
  const shotF=G.combat.playerShot(front,dirF,{damage:20,range:50});
  const hp1=h.hp, sh1=h.shieldHp;
  const shotB=G.combat.playerShot(back,dirB,{damage:20,range:50});
  return {rcF:rcF&&{part:rcF.part,dist:+rcF.dist.toFixed(2)},wF:wF&&{dist:+wF.dist.toFixed(2),surf:wF.surface},rcB:rcB&&{part:rcB.part,dist:+rcB.dist.toFixed(2)},wB:wB&&{dist:+wB.dist.toFixed(2),surf:wB.surface},hp0,shotF:shotF&&shotF.surface,hp1,sh1,shotB:shotB&&shotB.surface,hp2:h.hp,sh2:h.shieldHp};
}), null, 1).slice(0,4000));
await browser.close();
