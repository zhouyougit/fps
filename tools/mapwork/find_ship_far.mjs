
import { chromium } from 'playwright';
import { launchOptions } from '../pwargs.mjs';
const PTS=[[-33,0.3,3.4],[-30.4,0.3,8.6],[28.6,0.3,8.9],[-22,0.3,13.8]];
const browser=await chromium.launch(launchOptions({headless:true}));
const page=await browser.newPage({viewport:{width:480,height:270}});
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1&novisual=1',{waitUntil:'load',timeout:240000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:300000});
const out=await page.evaluate((pts)=>{
  const G=window.__G,P=G.physics; window.__SX.switchMap('ship'); G.game.start({skipIntro:true});
  const start=G.level.playerStart.pos;
  const hit=(x,z,y)=>{for(const b of P.boxes){if(b.bulletOnly)continue;if(b.max.y<=y+0.06||b.min.y>=y+1.8)continue;const cx=Math.max(b.min.x,Math.min(b.max.x,x)),cz=Math.max(b.min.z,Math.min(b.max.z,z));const dx=x-cx,dz=z-cz;if(dx*dx+dz*dz<0.1024)return true;}return false;};
  const ok=(x,z,y)=>!hit(x,z,y)&&Math.abs(P.groundHeight(x,z,y+2.5)-y)<=0.6&&!!P.nav.findPath(start,{x,y:0,z});
  const res=[];
  for(const p of pts){let best=null;
    for(let r=0.5;r<=40&&!best;r+=0.5)for(let a=0;a<36;a++){const x=p[0]+Math.cos(a/36*6.2832)*r,z=p[2]+Math.sin(a/36*6.2832)*r;if(ok(x,z,p[1])){const d=Math.hypot(x-p[0],z-p[2]);if(!best||d<best.dist)best={from:p,to:[+x.toFixed(2),p[1],+z.toFixed(2)],dist:+d.toFixed(2)}}}
    res.push(best||{from:p,ok:false});}
  return res;
},PTS);
console.log(JSON.stringify(out,null,1));
await browser.close();
