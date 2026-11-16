
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const room='v16-'+Date.now().toString(36);
const pages=[];
for(let i=0;i<2;i++){
  const p=await browser.newPage({ viewport:{width:1000,height:560} });
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
  await p.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
  await p.waitForTimeout(800);
  pages.push({p,errs});
}
console.log('join', await pages[0].p.evaluate(([room])=>{ window.__MP.join('ws://172.16.17.189:9100','A',room); return true; },[room]));
console.log('join2', await pages[1].p.evaluate(([room])=>{ window.__MP.join('ws://172.16.17.189:9100','B',room); return true; },[room]));
for(let i=0;i<20;i++){ await new Promise(r=>setTimeout(r,1000)); const s=await pages[0].p.evaluate(()=>window.__MP.state()); const s2=await pages[1].p.evaluate(()=>window.__MP.state()); if(s.active&&s2.active&&s.players>=2) { console.log('ready', JSON.stringify({s,s2})); break; } if(i===19) console.log('timeout', JSON.stringify({s,s2})); }
// move A forward
const before = await pages[0].p.evaluate(()=>({pos:window.__G.player.pos.toArray().map(v=>+v.toFixed(2)), state:window.__MP.state()}));
await pages[0].p.keyboard.down('w'); await new Promise(r=>setTimeout(r,2500)); await pages[0].p.keyboard.up('w');
await new Promise(r=>setTimeout(r,800));
const after = await pages[0].p.evaluate(()=>({pos:window.__G.player.pos.toArray().map(v=>+v.toFixed(2)), state:window.__MP.state()}));
const bView = await pages[1].p.evaluate(()=>({remotes:window.__MP.remotes(), state:window.__MP.state(), avatars:window.__G.scene.children.filter(o=>o.type==='Group'&&o.children.some(c=>c.type==='Capsule')).length}));
console.log('move', JSON.stringify({before,after,bView}));
console.log('errors', pages[0].errs.slice(0,3), pages[1].errs.slice(0,3));
await pages[0].p.screenshot({path:'tools/v16_mp.png',timeout:120000});
// exit
await pages[0].p.evaluate(()=>window.__MP.leave());
await new Promise(r=>setTimeout(r,800));
console.log('exit', JSON.stringify(await pages[0].p.evaluate(()=>({state:window.__G.game.state, mp:window.__MP.state()}))));
await browser.close();
