
import { chromium } from 'playwright';
const b = await chromium.launch({ headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const p = await b.newPage({ viewport:{width:640,height:400} });
await p.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:240000});
await p.waitForFunction(()=>window.__ready===true&&window.__SX_LOOP,null,{timeout:420000});
await p.waitForTimeout(1500);
const r = await p.evaluate(async ()=>{
  const G=window.__G;
  const f0=window.__frames;
  G.renderer.setAnimationLoop(null);
  await new Promise(r=>setTimeout(r,500));
  const f1=window.__frames;
  return { f0, f1, framesDelta:f1-f0, fn:String(G.renderer.setAnimationLoop).slice(0,200), ctor:G.renderer.constructor.name, engineStill: !!G.renderer, loop:window.__SX_LOOP.stats() };
});
console.log(JSON.stringify(r,null,2));
await b.close();
