
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:800,height:450} });
await page.goto('http://127.0.0.1:3311/game.html?shot=1&autostart=1&q=low&noaudio=1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
await page.waitForTimeout(1000);
const res = await page.evaluate(()=>{
  const G=window.__G,T=G.THREE;
  G.enemies.clear();
  const e=G.enemies.spawn('hound', new T.Vector3(0,0,0), {state:'alert', passive:true});
  e.pos.set(0,0,0);
  const origin=new T.Vector3(0,1.6,6);
  const dir=new T.Vector3(0,-0.8,-6).normalize();
  const rc = G.enemies.raycast(origin,dir,50);
  let hit=null;
  try { hit=G.combat.playerShot(origin, dir, {damage:11, range:90}); } catch(err){ hit={err:String(err)}; }
  const hp1=e.hp;
  // 9 pellets
  let total=0;
  for(let i=0;i<8;i++){ const d=new T.Vector3((Math.random()-0.5)*0.02, (Math.random()-0.5)*0.02, -1).normalize(); const h=G.combat.playerShot(origin,d,{damage:11,range:90}); if(h&&h.surface==='enemy') total++; }
  return {raycast: rc && {part:rc.part,dist:+rc.dist.toFixed(2)}, hit: hit && {surface:hit.surface, part:hit.part, killed:hit.killed}, hpBefore:140, hpAfter:hp1, hpAfterAll:e.hp, pelletsHit:total};
});
console.log(JSON.stringify(res));
await browser.close();
