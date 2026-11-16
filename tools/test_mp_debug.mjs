
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const room='v16d-'+Date.now().toString(36);
const pages=[];
for(let i=0;i<2;i++){
  const p=await browser.newPage({ viewport:{width:1000,height:560} });
  await p.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
  await p.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
  await p.waitForTimeout(600);
  await p.evaluate(([r,n])=>window.__MP.join('ws://172.16.17.189:9100',n,r),[room,i===0?'A':'B']);
  pages.push(p);
}
for(let i=0;i<12;i++){ await new Promise(r=>setTimeout(r,1000)); const s=await pages[1].evaluate(()=>window.__MP.state()); if(s.players>=2&&s.active) break; }
await new Promise(r=>setTimeout(r,1500));
console.log('A', JSON.stringify(await pages[0].evaluate(()=>window.__MP.debug())));
console.log('B', JSON.stringify(await pages[1].evaluate(()=>window.__MP.debug())));
const look = await pages[1].evaluate(()=>{
  const G=window.__G;
  const d=window.__MP.debug(); const g=d.hist[0]&&d.hist[0].h[d.hist[0].h.length-1];
  if(!g) return {found:false,d};
  const dx=g.x-G.player.pos.x, dz=g.z-G.player.pos.z;
  G.player.yaw=Math.atan2(-dx,-dz); G.player.pitch=0;
  return {found:true, remote:[g.x,g.y,g.z], me:G.player.pos.toArray(), dist:+Math.hypot(dx,dz).toFixed(2)};
});
await new Promise(r=>setTimeout(r,900));
console.log('look', JSON.stringify(look));
await pages[1].screenshot({path:'tools/v16_avatar3.png',timeout:120000});
await browser.close();
