
import { chromium } from 'playwright';
import { launchOptions } from '../pwargs.mjs';
const MAPS = {
  depot: [[27.8,0,27.8],[-27.5,0,24.6],[-36,0,-24.4],[28.5,0,-23.8],[0,0,-23.8]],
  ship: [[-30,0.3,-5.5],[22,0.3,-7.4],[-33,0.3,3.4],[-30.4,0.3,8.6],[28.6,0.3,8.9],[12,0.3,21],[16.8,0.3,21],[19.2,0.32,-7.2],[-26.5,0.3,-6.3],[26.5,0.3,-6.3],[-26,0.3,2],[26,0.3,2],[-22,0.3,13.8],[22,0.3,13.8],[-13.5,0.3,10.2],[13.5,0.3,10.2],[12,0.3,17.2],[16,0.3,18.5]],
  core: [[-35.2,0.4,16.5],[-35.2,0.4,-14.5]]
};
const browser = await chromium.launch(launchOptions({ headless: true }));
const page = await browser.newPage({ viewport:{width:480,height:270} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1&novisual=1',{waitUntil:'load',timeout:240000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:300000});
for (const [id, pts] of Object.entries(MAPS)) {
  const out = await page.evaluate(({id,pts})=>{
    const G=window.__G, P=G.physics;
    window.__SX.switchMap(id); G.game.start({skipIntro:true});
    const start=G.level.playerStart.pos;
    const hit=(x,z,y)=>{
      for (const b of P.boxes){ if(b.bulletOnly) continue; if(b.max.y<=y+0.06||b.min.y>=y+1.8) continue; const cx=Math.max(b.min.x,Math.min(b.max.x,x)), cz=Math.max(b.min.z,Math.min(b.max.z,z)); const dx=x-cx,dz=z-cz; if(dx*dx+dz*dz<0.32*0.32) return true; } return false;
    };
    const ok=(x,z,y)=> !hit(x,z,y) && Math.abs(P.groundHeight(x,z,y+2.5)-y)<=0.6 && !!P.nav.findPath(start,{x,y:0,z});
    const res=[];
    for (const p of pts){
      if(ok(p[0],p[2],p[1])) { res.push({from:p,to:p,dist:0,ok:true}); continue; }
      let best=null;
      for(let r=0.5;r<=14 && !best;r+=0.5){
        for(let a=0;a<24;a++){
          const x=p[0]+Math.cos(a/24*6.2832)*r, z=p[2]+Math.sin(a/24*6.2832)*r;
          if(ok(x,z,p[1])) { const d=Math.hypot(x-p[0],z-p[2]); if(!best||d<best.dist) best={from:p,to:[+x.toFixed(2),p[1],+z.toFixed(2)],dist:+d.toFixed(2),ok:true}; }
        }
      }
      res.push(best||{from:p,ok:false});
    }
    return {id,start:start.toArray(),res};
  },{id,pts});
  console.log(JSON.stringify(out,null,1));
}
await browser.close();
