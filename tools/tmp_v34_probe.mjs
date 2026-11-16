
import { chromium } from 'playwright';
const b = await chromium.launch({ headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const p = await b.newPage({ viewport:{width:800,height:480} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///Users/zhouyou/codex_workspace/fps/game_v34.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:240000});
await p.waitForFunction(()=>window.__ready===true&&window.__SX&&window.__SX_AI,null,{timeout:420000});
await p.waitForTimeout(1000);
const r=await p.evaluate(()=>{
  const G=window.__G,T=G.THREE; const out={};
  out.ai=!!window.__SX_AI; out.covers=(window.__SX_AI&&window.__SX_AI.covers&&window.__SX_AI.covers('harbor')||[]).length;
  const types=['scout','siege','emp','warden']; out.spawn={};
  for(const t of types){ try{ const e=G.enemies.spawn(t,new T.Vector3(-19+t.length,0,6),{state:'alert'}); out.spawn[t]=e?{hp:e.hp,type:e.type,variant:e.variant,alive:e.alive}:null; }catch(e){ out.spawn[t]='ERR '+e.message; } }
  window.__SX_LOOP.step(300);
  out.squads=window.__SX_AI&&window.__SX_AI.squads?window.__SX_AI.squads():null;
  out.err=(window.__errors||[]).slice(0,5);
  return out;
});
console.log(JSON.stringify(r,null,2)); console.log('pageerrs',errs.slice(0,5));
try{ await Promise.race([b.close(),new Promise(r=>setTimeout(r,2000))]); }catch(e){}
process.exit(0);
