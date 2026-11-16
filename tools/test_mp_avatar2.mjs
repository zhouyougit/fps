
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const room='v16c-'+Date.now().toString(36);
const pages=[];
for(let i=0;i<2;i++){
  const p=await browser.newPage({ viewport:{width:1000,height:560} });
  await p.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
  await p.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
  await p.waitForTimeout(600);
  await p.evaluate(([r,n])=>window.__MP.join('ws://172.16.17.189:9100',n,r),[room,i===0?'A':'B']);
  pages.push(p);
}
for(let i=0;i<15;i++){ await new Promise(r=>setTimeout(r,1000)); const s=await pages[1].evaluate(()=>window.__MP.state()); if(s.players>=2&&s.active) break; }
// B looks at A remote snapshot position
const looks = await pages[1].evaluate(()=>{
  const G=window.__G;
  const grp=G.scene.children.find(o=>o.type==='Group'&&o.children.some(c=>c.geometry&&c.geometry.type==='CapsuleGeometry'));
  if(!grp) return {found:false};
  const dx=grp.position.x-G.player.pos.x, dz=grp.position.z-G.player.pos.z;
  G.player.yaw=Math.atan2(-dx,-dz); G.player.pitch=0;
  return {found:true, remote:grp.position.toArray().map(v=>+v.toFixed(2)), me:G.player.pos.toArray().map(v=>+v.toFixed(2)), dist:+Math.hypot(dx,dz).toFixed(2)};
});
await new Promise(r=>setTimeout(r,800));
console.log('look', JSON.stringify(looks));
await pages[1].screenshot({path:'tools/v16_avatar2.png',timeout:120000});
await browser.close();
