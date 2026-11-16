
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:640,height:360} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
await page.waitForTimeout(800);
console.log(JSON.stringify(await page.evaluate(()=>{
  const G=window.__G,T=G.THREE, out=[];
  const cands=[[0,12],[-2,12],[10,14],[22,6],[-30,6],[10,20],[5,20],[-10,16],[20,18],[26,22]];
  for(const [x,z] of cands){
    G.enemies.clear();
    const h=G.enemies.spawn('heavy', new T.Vector3(x,0,z), {yaw:0});
    const front=new T.Vector3(x,1.6,z+6), dirF=new T.Vector3(0,-0.85,-6).normalize();
    const back=new T.Vector3(x,1.6,z-6), dirB=new T.Vector3(0,-0.85,6).normalize();
    const rcF=G.enemies.raycast(front,dirF,50), wF=G.physics.raycast(front,dirF,50);
    const rcB=G.enemies.raycast(back,dirB,50), wB=G.physics.raycast(back,dirB,50);
    out.push({x,z,front:!!rcF&&(!wF||wF.dist>rcF.dist), back:!!rcB&&(!wB||wB.dist>rcB.dist), rcF:rcF&&rcF.part, wF:wF&&+wF.dist.toFixed(1), rcB:rcB&&rcB.part, wB:wB&&+wB.dist.toFixed(1)});
  }
  return out;
}), null, 1).slice(0,4000));
await browser.close();
