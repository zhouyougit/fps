
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const room='chaos-'+Date.now();
let fails=0; const ok=(n,c,d)=>{ if(!c) fails++; console.log((c?'PASS':'FAIL')+' · '+n+(d?' — '+JSON.stringify(d):'')); };
const pages=[];
for(let i=0;i<3;i++){ const p=await browser.newPage({viewport:{width:1000,height:560}}); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); await p.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:240000}); await p.waitForFunction(()=>window.__ready===true,null,{timeout:420000}); pages.push({p,errs}); }
for(let i=0;i<3;i++) await pages[i].p.evaluate(([n,r])=>window.__MP.join('ws://172.16.17.189:9100',n,r,'harbor','chaos'),['P'+i,room]);
for(let i=0;i<20;i++){ await new Promise(r=>setTimeout(r,1000)); const s=await pages[0].p.evaluate(()=>window.__MP.state()); if(s.players>=3&&s.active) break; }
const states=await Promise.all(pages.map(x=>x.p.evaluate(()=>window.__MP.state())));
ok('大乱战 6v6 模式', states.every(s=>s.mode==='chaos'), states.map(s=>s.mode));
const teams=states.map(s=>s.team); ok('自动平衡 2v1', teams.filter(t=>t===0).length===2 && teams.filter(t=>t===1).length===1, teams);
const pos=await Promise.all(pages.map(x=>x.p.evaluate(()=>window.__G.player.pos.toArray().map(v=>+v.toFixed(1)))));
let min=99; for(let i=0;i<pos.length;i++) for(let j=i+1;j<pos.length;j++) min=Math.min(min,Math.hypot(pos[i][0]-pos[j][0],pos[i][2]-pos[j][2]));
ok('出生点不重叠', min>0.8, {pos,min:+min.toFixed(2)});
await pages[0].p.keyboard.press('Tab'); await new Promise(r=>setTimeout(r,400));
const sb=await pages[0].p.evaluate(()=>({title:document.querySelector('.x-mp-score h3').textContent, rows:document.querySelectorAll('.x-mp-score tbody tr').length, sub:(document.querySelector('.x-mp-sub')||{}).textContent}));
ok('计分板', sb.rows===3 && /大乱战/.test(sb.title), sb);
ok('无错误', pages.every(x=>x.errs.length===0), pages.map(x=>x.errs.slice(0,1)));
await pages[0].p.screenshot({path:'tools/v31_chaos.png',timeout:120000});
await browser.close();
console.log(fails?fails+' 项失败':'全部通过');
process.exit(fails?1:0);
