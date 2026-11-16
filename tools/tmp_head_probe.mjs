
import { chromium } from 'playwright';
const b=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files']});
const p=await b.newPage({viewport:{width:900,height:520}});
await p.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:240000});
await p.waitForFunction(()=>window.__ready===true&&window.__SX,null,{timeout:420000});
const r=await p.evaluate(()=>[...document.querySelectorAll('.panel-b h3')].map(h=>({t:h.textContent,src:h.__sxSrc,key:h.__sxKey,cls:h.parentElement.className})));
console.log(JSON.stringify(r,null,2));
try{await Promise.race([b.close(),new Promise(r=>setTimeout(r,2000))]);}catch(e){}
process.exit(0);
