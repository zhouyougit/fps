
import { chromium } from 'playwright';
const URL='ws://172.16.17.189:9100';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
let fails=0; const ok=(n,c,d)=>{ if(!c) fails++; console.log((c?'PASS':'FAIL')+' · '+n+(d?' — '+JSON.stringify(d):'')); };
async function joinPair(mapId, room){
  const pages=[];
  for(let i=0;i<2;i++){
    const p=await browser.newPage({ viewport:{width:1000,height:560} });
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
    await p.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
    await p.waitForTimeout(600);
    await p.evaluate(([u,r,n,m])=>window.__MP.join(u,n,r,m),[URL,room,i===0?'A':'B',mapId]);
    pages.push({p,errs});
  }
  for(let i=0;i<15;i++){ await new Promise(r=>setTimeout(r,1000)); const s=await pages[0].p.evaluate(()=>window.__MP.state()); if(s.players>=2&&s.active) break; }
  return pages;
}
{
  const pages=await joinPair('depot','mapdepot-'+Date.now().toString(36));
  const a=await pages[0].p.evaluate(()=>({map:window.__SX.mapId(), mp:window.__MP.state(), pos:window.__G.player.pos.toArray().map(v=>+v.toFixed(1)), hud:(document.querySelector('[data-mp-room]')||{}).textContent, boxes:window.__G.physics.boxes.length}));
  const b=await pages[1].p.evaluate(()=>({map:window.__SX.mapId(), mp:window.__MP.state(), pos:window.__G.player.pos.toArray().map(v=>+v.toFixed(1)), boxes:window.__G.physics.boxes.length}));
  ok('冷库联机地图', a.map==='depot' && b.map==='depot' && a.mp.map==='depot' && a.boxes===238 && b.boxes===238, {a,b});
  ok('冷库分队出生', Math.abs(a.pos[0])>1 || Math.abs(b.pos[0])>1 || Math.abs(a.pos[2]-b.pos[2])>10, {a:a.pos,b:b.pos});
  await pages[0].p.keyboard.down('w'); await new Promise(r=>setTimeout(r,1800)); await pages[0].p.keyboard.up('w');
  await new Promise(r=>setTimeout(r,800));
  const moved=await pages[1].p.evaluate(()=>{ const d=window.__MP.debug(); const h=d.hist[0]&&d.hist[0].h[d.hist[0].h.length-1]; return h; });
  ok('冷库内同步', !!moved, moved);
  await pages[1].p.screenshot({path:'tools/v21_depot_mp.png',timeout:120000});
  for(const x of pages) await x.p.close();
}
{
  const pages=await joinPair('ship','mapship-'+Date.now().toString(36));
  const a=await pages[0].p.evaluate(()=>({map:window.__SX.mapId(), sea:window.__G.ground.root.getObjectByName('sea').visible, apron:window.__G.ground.root.getObjectByName('apron').visible, mp:window.__MP.state(), pos:window.__G.player.pos.toArray().map(v=>+v.toFixed(1)), boxes:window.__G.physics.boxes.length}));
  ok('货轮联机地图', a.map==='ship' && a.mp.map==='ship' && a.sea && !a.apron && a.boxes===94, a);
  await pages[1].p.screenshot({path:'tools/v21_ship_mp.png',timeout:120000});
  for(const x of pages) await x.p.close();
}
console.log(fails?fails+' 项失败':'全部通过');
await browser.close();
process.exit(fails?1:0);
