
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const room='v30-'+Date.now();
const pages=[];
for(let i=0;i<2;i++){ const p=await browser.newPage({viewport:{width:1280,height:720}}); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); await p.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000}); await p.waitForFunction(()=>window.__ready===true,null,{timeout:240000}); await p.waitForTimeout(700); await p.evaluate(([n,r])=>window.__MP.join('ws://172.16.17.189:9100',n,r,'harbor'),[i?'B':'A',room]); pages.push({p,errs}); }
for(let i=0;i<12;i++){ await new Promise(r=>setTimeout(r,1000)); const s=await pages[0].p.evaluate(()=>window.__MP.state()); if(s.players>=2&&s.active) break; }
await pages[0].p.evaluate(()=>{ window.__MP.testTeleport(-2,12); window.__G.player.yaw=-1.57; window.__G.player.pitch=-0.02; });
await pages[1].p.evaluate(()=>window.__MP.testTeleport(2,12));
await new Promise(r=>setTimeout(r,2200));
const info=await pages[0].p.evaluate(()=>{ const d=window.__MP.debug(); const h=d.hist[0]&&d.hist[0].h[d.hist[0].h.length-1]; return {hist:h, remoteKids: (()=>{const g=window.__G.scene.children.find(o=>o.name==='mp-player'); return g?g.children.length:0;})(), count:window.__MP.state().players, lobby:document.querySelector('.x-mp-sub')&&document.querySelector('.x-mp-sub').textContent}; });
console.log('info', JSON.stringify(info));
await pages[0].p.screenshot({path:'tools/v30_remote.png',timeout:120000});
// spawn protection indicator on B: check snapshot field
console.log('B protect', JSON.stringify(await pages[1].p.evaluate(()=>({protect:window.__MPSNAP&&window.__MPSNAP.find(p=>p.id!==window.__MP.state().selfId)?.spawnProtect, self:(window.__MPSNAP||[]).find(p=>p.id===window.__MP.state().selfId)?.spawnProtect}))));
console.log('errs', JSON.stringify(pages.map(x=>x.errs.slice(0,2))));
await browser.close();
