
import { chromium } from 'playwright';
const b = await chromium.launch({ headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const p = await b.newPage({ viewport:{width:800,height:480} });
await p.goto('file:///Users/zhouyou/codex_workspace/fps/game_v34.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:240000});
await p.waitForFunction(()=>window.__ready===true&&window.__SX2,null,{timeout:420000});
await p.waitForTimeout(800);
const r=await p.evaluate(()=>{
  const G=window.__G;
  window.__SX.applyMission(6); G.game.start({skipIntro:true});
  window.__SX_LOOP.step(5);
  window.__SX.god(); window.__SX.cutAll();
  window.__SX_LOOP.step(5);
  const before=window.__SX2.graph();
  const k=window.__SX2.kill(18);
  window.__SX_LOOP.step(5);
  const after=window.__SX2.graph();
  return {before:before&&before.phases.map(x=>x.type+':'+x.state+':'+x.progress), k, after:after&&after.phases.map(x=>x.type+':'+x.state+':'+x.progress), err:(window.__errors||[]).slice(0,5)};
});
console.log(JSON.stringify(r,null,2));
try{ await Promise.race([b.close(),new Promise(r=>setTimeout(r,2000))]); }catch(e){}
process.exit(0);
