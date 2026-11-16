
import { chromium } from 'playwright';
const URL='ws://172.16.17.189:9100';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
let fails=0; const ok=(n,c,d)=>{ if(!c) fails++; console.log((c?'PASS':'FAIL')+' · '+n+(d?' — '+JSON.stringify(d):'')); };
const room='core-'+Date.now().toString(36);
const pages=[];
for(let i=0;i<2;i++){
  const p=await browser.newPage({ viewport:{width:1000,height:560} });
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
  await p.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
  await p.waitForTimeout(600);
  await p.evaluate(([u,r,n])=>window.__MP.join(u,n,r,'core'),[URL,room,i===0?'A':'B']);
  pages.push({p,errs});
}
for(let i=0;i<15;i++){ await new Promise(r=>setTimeout(r,1000)); const s=await pages[0].p.evaluate(()=>window.__MP.state()); if(s.players>=2&&s.active) break; }
const a=await pages[0].p.evaluate(()=>({map:window.__SX.mapId(), mp:window.__MP.state(), pos:window.__G.player.pos.toArray().map(v=>+v.toFixed(1)), boxes:window.__G.physics.boxes.length, hud:(document.querySelector('[data-mp-room]')||{}).textContent, sea:window.__G.ground.root.getObjectByName('sea').visible, sky:window.__G.render.sky.visible, loading:document.querySelector('.x-mp-loading').classList.contains('on')}));
const b=await pages[1].p.evaluate(()=>({map:window.__SX.mapId(), boxes:window.__G.physics.boxes.length, pos:window.__G.player.pos.toArray().map(v=>+v.toFixed(1))}));
ok('核心舱联机地图', a.map==='core' && b.map==='core' && a.mp.map==='core' && a.boxes===108 && b.boxes===108, {a,b});
ok('核心舱出生与关闭天空', a.pos[1]<1 && !a.sky, a);
ok('核心舱加载完成', !a.loading, a.loading);
await pages[0].p.keyboard.down('w'); await new Promise(r=>setTimeout(r,1500)); await pages[0].p.keyboard.up('w');
await new Promise(r=>setTimeout(r,700));
const moved=await pages[1].p.evaluate(()=>{ const d=window.__MP.debug(); return d.hist[0]&&d.hist[0].h[d.hist[0].h.length-1]; });
ok('核心舱同步', !!moved, moved);
await pages[0].p.screenshot({path:'tools/v25_core.png',timeout:120000});
ok('无错误', pages[0].errs.length===0 && pages[1].errs.length===0, {a:pages[0].errs.slice(0,2),b:pages[1].errs.slice(0,2)});
await browser.close();
console.log(fails?fails+' 项失败':'全部通过');
process.exit(fails?1:0);
