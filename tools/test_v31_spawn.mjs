
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const room='sp-'+Date.now();
const pages=[];
for(let i=0;i<2;i++){ const p=await browser.newPage({viewport:{width:900,height:500}}); await p.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:240000}); await p.waitForFunction(()=>window.__ready===true,null,{timeout:420000}); pages.push(p); }
for(let i=0;i<2;i++) await pages[i].evaluate(([n,r])=>window.__MP.join('ws://172.16.17.189:9100',n,r,'harbor','chaos'),['P'+i,room]);
for(let i=0;i<15;i++){ await new Promise(r=>setTimeout(r,1000)); const s=await pages[0].evaluate(()=>window.__MP.state()); if(s.players>=2&&s.active) break; }
await new Promise(r=>setTimeout(r,1200));
console.log(JSON.stringify(await Promise.all(pages.map(p=>p.evaluate(()=>({pos:window.__G.player.pos.toArray().map(v=>+v.toFixed(2)), team:window.__MP.state().team, mode:window.__MP.state().mode}))))));
await browser.close();
