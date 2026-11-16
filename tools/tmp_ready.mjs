
import { chromium } from 'playwright';
const b = await chromium.launch({ headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const p = await b.newPage({ viewport:{width:800,height:480} });
p.on('pageerror',e=>console.log('PAGEERR',e.message));
p.on('console',m=>{ if(m.type()==='error') console.log('CONSOLE',m.text().slice(0,200)); });
const t0=Date.now();
await p.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:240000});
console.log('loaded',Date.now()-t0);
await p.waitForFunction(()=>window.__ready===true,null,{timeout:120000}).catch(e=>console.log('ready timeout'));
console.log('ready',Date.now()-t0);
await p.waitForTimeout(1000);
console.log(JSON.stringify(await p.evaluate(()=>({ready:window.__ready, err:(window.__errors||[]).slice(0,5), loop:window.__SX_LOOP&&window.__SX_LOOP.stats(), state:window.__G&&window.__G.game.state, pickups:window.__SX&&window.__SX.S.pickups.length}))));
await b.close();
