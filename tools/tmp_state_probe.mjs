
import { chromium } from 'playwright';
const b=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files']});
const p=await b.newPage({viewport:{width:800,height:480}});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:240000});
await p.waitForFunction(()=>window.__ready===true&&window.__SX,null,{timeout:420000});
await p.waitForTimeout(2500);
const r=await p.evaluate(()=>({state:window.__G.game.state,params:window.__G.params,ready:window.__ready,fatal:window.__fatal,err:(window.__errors||[]).slice(0,5),screen:[...document.querySelectorAll('.m-screen')].map(x=>x.dataset.s+':'+getComputedStyle(x).display).slice(0,5)}));
console.log(JSON.stringify(r,null,2)); console.log('pageerrs',errs.slice(0,5));
try{await Promise.race([b.close(),new Promise(r=>setTimeout(r,2000))]);}catch(e){}
process.exit(0);
