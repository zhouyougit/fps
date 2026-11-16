
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:800,height:450} });
await page.goto('http://127.0.0.1:3311/game.html?shot=1&autostart=1&q=low&noaudio=1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
await page.waitForTimeout(1000);
const res = await page.evaluate(()=>{
  const G=window.__G,T=G.THREE;
  G.enemies.clear();
  const out=[];
  const spots=[[-19,4],[-19,10],[20,10],[22,6],[-2,12],[-30,6]];
  for (const [x,z] of spots){
    const e=G.enemies.spawn('hound', new T.Vector3(x,0,z), {state:'alert', passive:true});
    if(!e){out.push({x,z,err:'no pool'});continue;}
    e.pos.set(x,0,z);
    const origin=new T.Vector3(x,1.6,z+5);
    const dir=new T.Vector3(0,-0.7,-5).normalize();
    const rc=G.enemies.raycast(origin,dir,50);
    const wall=G.physics.raycast(origin,dir,50);
    const los=G.physics.lineOfSight(origin, new T.Vector3(x,0.9,z));
    let h=null; try{h=G.combat.playerShot(origin,dir,{damage:11,range:90});}catch(err){h={err:String(err)}}
    out.push({x,z,rc:rc&&{part:rc.part,dist:+rc.dist.toFixed(2)},wall:wall&&{dist:+wall.dist.toFixed(2),surface:wall.surface},los,hit:h&&{surface:h.surface,part:h.part},hp:e.hp});
    G.enemies.clear();
  }
  return out;
});
console.log(JSON.stringify(res,null,1));
await browser.close();
