
import { chromium } from 'playwright';
const b = await chromium.launch({ headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const p = await b.newPage({ viewport:{width:1000,height:560} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///Users/zhouyou/codex_workspace/fps/game_v35.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:240000});
await p.waitForFunction(()=>window.__ready===true&&window.__SX,null,{timeout:420000});
await p.waitForTimeout(1200);
const r=await p.evaluate(()=>{
  const out={ui:!!window.__SX_UI2, lang:!!window.__SX_LANG, visual:!!window.__SX_VISUAL, music:!!window.__SX_MUSIC, missing:null, zh:null, en:null};
  try{ out.missing=window.__SX_LANG.missing(); }catch(e){ out.missingErr=String(e); }
  try{ out.zh=document.querySelector('.m-word')&&document.querySelector('.m-word').textContent; }catch(e){}
  try{ window.__SX_LANG.set('en'); }catch(e){ out.setErr=String(e); }
  out.en=document.querySelector('.m-word')&&document.querySelector('.m-word').textContent;
  try{ window.__SX_LANG.set('zh-CN'); }catch(e){}
  out.back=document.querySelector('.m-word')&&document.querySelector('.m-word').textContent;
  out.vstats=window.__SX_VISUAL&&window.__SX_VISUAL.stats&&window.__SX_VISUAL.stats();
  out.mstate=window.__SX_MUSIC&&window.__SX_MUSIC.state();
  out.err=(window.__errors||[]).slice(0,5);
  return out;
});
console.log(JSON.stringify(r,null,2)); console.log('pageerrs',errs.slice(0,5));
try{ await Promise.race([b.close(),new Promise(r=>setTimeout(r,2000))]); }catch(e){}
process.exit(0);
