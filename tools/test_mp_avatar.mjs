
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const room='v16b-'+Date.now().toString(36);
const pages=[];
for(let i=0;i<2;i++){
  const p=await browser.newPage({ viewport:{width:1000,height:560} });
  await p.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
  await p.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
  await p.waitForTimeout(600);
  await p.evaluate(([r,n])=>window.__MP.join('ws://172.16.17.189:9100',n,r),[room,i===0?'A':'B']);
  pages.push(p);
}
for(let i=0;i<15;i++){ await new Promise(r=>setTimeout(r,1000)); const s=await pages[0].evaluate(()=>window.__MP.state()); const s2=await pages[1].evaluate(()=>window.__MP.state()); if(s.players>=2&&s2.players>=2&&s.active&&s2.active) break; }
const b = await pages[1].evaluate(()=>({pos:window.__G.player.pos.toArray(), yaw:window.__G.player.yaw}));
await pages[0].evaluate(([b])=>{
  const G=window.__G; const y=b.yaw; const fx=-Math.sin(y), fz=-Math.cos(y);
  G.player.pos.set(b.pos[0]+fx*4, b.pos[1], b.pos[2]+fz*4);
  G.player.yaw=y+Math.PI;
},[b]);
await new Promise(r=>setTimeout(r,2500));
const info = await pages[1].evaluate(()=>{
  const G=window.__G;
  const groups=G.scene.children.filter(o=>o.type==='Group'&&o.children.some(c=>c.geometry&&c.geometry.type==='CapsuleGeometry'));
  return {count:groups.length, info:groups.map(g=>({pos:g.position.toArray().map(v=>+v.toFixed(2)), visible:g.visible, kids:g.children.length})), remotes:window.__MP.remotes(), mp:window.__MP.state()};
});
console.log('B sees', JSON.stringify(info));
const self = await pages[0].evaluate(()=>({player:window.__G.player.pos.toArray().map(v=>+v.toFixed(2)), mp:window.__MP.state()}));
console.log('A', JSON.stringify(self));
await pages[1].screenshot({path:'tools/v16_avatar.png',timeout:120000});
await pages[0].evaluate(()=>window.__MP.leave());
await new Promise(r=>setTimeout(r,600));
console.log('leave', JSON.stringify(await pages[0].evaluate(()=>({state:window.__G.game.state, mp:window.__MP.state()}))));
await browser.close();
