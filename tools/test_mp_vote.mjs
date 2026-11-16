
import { chromium } from 'playwright';
const URL='ws://172.16.17.189:9100';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
let fails=0; const ok=(n,c,d)=>{ if(!c) fails++; console.log((c?'PASS':'FAIL')+' · '+n+(d?' — '+JSON.stringify(d):'')); };
const room='vote-'+Date.now().toString(36);
const pages=[];
for(let i=0;i<2;i++){
  const p=await browser.newPage({ viewport:{width:1000,height:560} });
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
  await p.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
  await p.waitForTimeout(600);
  await p.evaluate(([u,r,n])=>window.__MP.join(u,n,r,'harbor'),[URL,room,i===0?'A':'B']);
  pages.push({p,errs});
}
for(let i=0;i<15;i++){ await new Promise(r=>setTimeout(r,1000)); const s=await pages[0].p.evaluate(()=>window.__MP.state()); if(s.players>=2&&s.active) break; }
await pages[0].p.evaluate(()=>window.__MP.testRound());
await new Promise(r=>setTimeout(r,700));
const vote=await pages[0].p.evaluate(()=>({on:document.querySelector('.x-mp-vote').classList.contains('on')}));
ok('回合结束弹选图', vote.on, vote);
await pages[0].p.evaluate(()=>window.__MP.vote('depot'));
await pages[1].p.evaluate(()=>window.__MP.vote('depot'));
await new Promise(r=>setTimeout(r,3500));
const a=await pages[0].p.evaluate(()=>({map:window.__SX.mapId(), mp:window.__MP.state(), boxes:window.__G.physics.boxes.length, vote:document.querySelector('.x-mp-vote').classList.contains('on'), pos:window.__G.player.pos.toArray().map(v=>+v.toFixed(1))}));
const b=await pages[1].p.evaluate(()=>({map:window.__SX.mapId(), boxes:window.__G.physics.boxes.length}));
ok('投票后换图', a.map==='depot' && b.map==='depot' && a.mp.map==='depot' && a.boxes===238 && b.boxes===238, {a,b});
ok('换图后回合开始', !a.vote, a);
await pages[0].p.screenshot({path:'tools/v22_vote.png',timeout:120000});
ok('无错误', pages[0].errs.length===0 && pages[1].errs.length===0, {a:pages[0].errs.slice(0,2),b:pages[1].errs.slice(0,2)});
await browser.close();
console.log(fails?fails+' 项失败':'全部通过');
process.exit(fails?1:0);
