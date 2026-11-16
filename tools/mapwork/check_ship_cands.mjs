
import { chromium } from 'playwright';
import { launchOptions } from '../pwargs.mjs';
const CAND=[[8,0.3,-4],[10,0.3,-3],[12,0.3,-2],[6,0.3,-4],[14,0.3,-4],[8,0.3,0],[12,0.3,0],[4,0.3,-6],[10,0.3,3],[6,0.3,3]];
const browser=await chromium.launch(launchOptions({headless:true}));
const page=await browser.newPage({viewport:{width:480,height:270}});
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1&novisual=1',{waitUntil:'load',timeout:240000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:300000});
const res=await page.evaluate((cand)=>{
 const G=window.__G,P=G.physics; window.__SX.switchMap('ship'); G.game.start({skipIntro:true});
 const start=G.level.playerStart.pos;
 const hit=(x,z,y)=>{for(const b of P.boxes){if(b.bulletOnly)continue;if(b.max.y<=y+0.06||b.min.y>=y+1.8)continue;const cx=Math.max(b.min.x,Math.min(b.max.x,x)),cz=Math.max(b.min.z,Math.min(b.max.z,z));const dx=x-cx,dz=z-cz;if(dx*dx+dz*dz<0.1024)return true;}return false;};
 return cand.map(p=>({p,ok:!hit(p[0],p[2],p[1])&&Math.abs(P.groundHeight(p[0],p[2],p[1]+2.5)-p[1])<=0.6&&!!P.nav.findPath(start,{x:p[0],y:0,z:p[2]})}));
},CAND);
console.log(JSON.stringify(res,null,1));
await browser.close();
