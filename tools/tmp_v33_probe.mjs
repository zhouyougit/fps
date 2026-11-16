
import { chromium } from 'playwright';
const b = await chromium.launch({ headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const p = await b.newPage({ viewport:{width:1000,height:560} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///Users/zhouyou/codex_workspace/fps/game_v33.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:240000});
await p.waitForFunction(()=>window.__ready===true&&window.__SX,null,{timeout:420000});
await p.waitForTimeout(1200);
const r = await p.evaluate(()=>{
  const G=window.__G, S=window.__SX;
  const out={ weapons:G.weapon.list.map(w=>({id:w.id,mag:w.magSize,short:w.short})), move:!!window.__SX_MOVE, feedback:!!window.__SX_FEEDBACK, input:!!window.__SX_INPUT2, audio:!!window.__SX_AUDIO2 };
  try { out.slideBefore={speed:+G.player.speed.toFixed(2)}; window.__SX_MOVE && window.__SX_MOVE.slide(); out.slideState=window.__SX_MOVE&&window.__SX_MOVE.state(); } catch(e){ out.slideErr=String(e); }
  try { G.weapon.select(3); out.slot4=G.weapon.activeIndex; } catch(e){ out.slotErr=String(e); }
  try { window.__SX_FEEDBACK && window.__SX_FEEDBACK.hit('head'); out.fb=!!document.querySelector('.x-fbh') || document.body.innerHTML.length>0; } catch(e){ out.fbErr=String(e); }
  out.err=(window.__errors||[]).slice(0,5);
  return out;
});
console.log(JSON.stringify(r,null,2));
console.log('pageerrs',errs.slice(0,5));
try{ await Promise.race([b.close(),new Promise(r=>setTimeout(r,2000))]); }catch(e){}
process.exit(0);
