
import { chromium } from 'playwright';
const b = await chromium.launch({ headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const p = await b.newPage({ viewport:{width:1000,height:560} });
await p.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:240000});
await p.waitForFunction(()=>window.__ready===true&&window.__SX_LOOP,null,{timeout:420000});
await p.waitForTimeout(1200);
const r = await p.evaluate(async ()=>{
  const G=window.__G; const hits=[]; let last='';
  const wrap=(obj,name)=>{const o=obj[name];obj[name]=function(dt){ if(Math.abs(dt-1/60)>1e-6 && hits.length<8) hits.push({name,dt,stack:new Error().stack}); return o.call(this,dt); };};
  wrap(G.player,'update'); wrap(G.weapon,'update'); wrap(G.enemies,'update');
  const t0=window.__SX_LOOP.tick();
  await new Promise(r=>setTimeout(r,1600));
  return {hits, tick0:t0, tick1:window.__SX_LOOP.tick(), frames:window.__frames, loop: window.__SX_LOOP.stats()};
});
console.log(JSON.stringify(r,null,2));
await b.close();
