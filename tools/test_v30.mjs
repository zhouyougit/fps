
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
let fails=0; const ok=(n,c,d)=>{ if(!c) fails++; console.log((c?'PASS':'FAIL')+' · '+n+(d?' — '+JSON.stringify(d):'')); };
const room='v30t-'+Date.now();
const pages=[];
for(let i=0;i<2;i++){ const p=await browser.newPage({viewport:{width:1280,height:720}}); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); await p.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:240000}); await p.waitForFunction(()=>window.__ready===true,null,{timeout:420000}); pages.push({p,errs}); }
const lobby=await pages[0].p.evaluate(()=>({sub:(document.querySelector('.x-mp-sub')||{}).textContent, max:window.__SX?null:null}));
ok('大厅 12 人', /2–12/.test(lobby.sub||''), lobby);
for(let i=0;i<2;i++) await pages[i].p.evaluate(([n,r])=>window.__MP.join('ws://172.16.17.189:9100',n,r,'harbor'),[i?'B':'A',room]);
for(let i=0;i<15;i++){ await new Promise(r=>setTimeout(r,1000)); const s=await pages[0].p.evaluate(()=>window.__MP.state()); if(s.players>=2&&s.active) break; }
await new Promise(r=>setTimeout(r,2600));
const parts=await pages[0].p.evaluate(()=>window.__MP.debug().parts);
ok('远端角色模型 2.0', parts.length===1 && parts[0].kids>=8 && parts[0].tag, parts);
await pages[0].p.evaluate(()=>{ window.__MP.testTeleport(-6,0); window.__G.player.yaw=-1.57; window.__G.player.pitch=0.06; });
await pages[1].p.evaluate(()=>window.__MP.testTeleport(2,0));
await new Promise(r=>setTimeout(r,1400));
await pages[0].p.evaluate(()=>{ const b=document.querySelector('[data-guide-skip]'); if(b) b.click(); });
const aim=await pages[0].p.evaluate(()=>{ const d=window.__MP.debug(); const h=d.hist[0]&&d.hist[0].h[d.hist[0].h.length-1]; const me=window.__G.player.pos, ox=me.x,oy=me.y+1.68,oz=me.z; const dx=h.x-ox,dy=(h.y+1.0)-oy,dz=h.z-oz,L=Math.hypot(dx,dy,dz); return {x:dx/L,y:dy/L,z:dz/L,dist:+L.toFixed(1)}; });
ok('远端可见', !!aim && aim.dist<12, aim);
await pages[0].p.screenshot({path:'tools/v30_remote.png',timeout:120000});
for(let i=0;i<3;i++){ await pages[0].p.evaluate(([d])=>window.__MP.testFire(d),[aim]); await new Promise(r=>setTimeout(r,140)); }
await new Promise(r=>setTimeout(r,300));
const hit=await pages[1].p.evaluate(()=>({dir:document.querySelector('.x-hit-dir').classList.contains('on'), hp:window.__G.player.health}));
ok('受击方向与伤害', hit.dir && hit.hp<100, hit);
for(let i=0;i<10;i++){ await pages[0].p.evaluate(([d])=>window.__MP.testFire(d),[aim]); await new Promise(r=>setTimeout(r,130)); }
await new Promise(r=>setTimeout(r,900));
const dead=await pages[1].p.evaluate(()=>({on:document.querySelector('.x-mp-dead').classList.contains('on'), text:document.querySelector('.x-mp-dead .s').textContent}));
ok('击杀与重生倒计时', /秒后重生|即将重生/.test(dead.text||''), dead);
ok('无错误', pages[0].errs.length===0 && pages[1].errs.length===0, {a:pages[0].errs.slice(0,2),b:pages[1].errs.slice(0,2)});
await browser.close();
console.log(fails?fails+' 项失败':'全部通过');
process.exit(fails?1:0);
