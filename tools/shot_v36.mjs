
import { chromium } from 'playwright';
const b = await chromium.launch({ headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const p = await b.newPage({ viewport:{width:1280,height:720} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///Users/zhouyou/codex_workspace/fps/versions/几猫_V36.html?q=low&noaudio=1',{waitUntil:'load',timeout:240000});
await p.waitForFunction(()=>window.__ready===true&&window.__SX,null,{timeout:480000});
await p.waitForTimeout(1200);
const info=await p.evaluate(()=>{ const out={mp:!!window.__MP,net:!!window.__SX_NET}; try{ window.__MP.open(); }catch(e){ out.openErr=String(e); } out.modes=[...document.querySelectorAll('[data-mp-mode]')].map(x=>x.textContent); out.err=(window.__errors||[]).slice(0,3); return out; });
await p.waitForTimeout(1200);
await p.screenshot({path:'versions/screens/v36_lobby.png',timeout:120000});
console.log(JSON.stringify(info));
console.log('pageerrs',errs.slice(0,3));
try{ await Promise.race([b.close(),new Promise(r=>setTimeout(r,3000))]); }catch(e){}
process.exit(0);
