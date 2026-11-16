
import { chromium } from 'playwright';
const URL='file:///Users/zhouyou/codex_workspace/fps/game.html';
const args=['--enable-gpu','--use-angle=metal','--ignore-gpu-blocklist','--allow-file-access-from-files'];
const b=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args});
const p=await b.newPage({viewport:{width:1000,height:560}});
for (const [name,url] of [
 ['metal low', URL+'?q=low&noaudio=1&autostart=1'],
 ['metal low novisual', URL+'?q=low&novisual=1&noaudio=1&autostart=1'],
 ['metal low reload', URL+'?q=low&noaudio=1&autostart=1']
]) {
  const t0=Date.now();
  await p.goto(url,{waitUntil:'load',timeout:240000});
  await p.waitForFunction(()=>window.__ready===true,null,{timeout:300000});
  const ready=Date.now()-t0;
  const f=await p.evaluate(async()=>{const f0=window.__frames,t=performance.now();await new Promise(r=>setTimeout(r,3000));return {frames:window.__frames-f0,ms:performance.now()-t,calls:window.__G.renderer.info.render.calls};});
  console.log(JSON.stringify({name,readyMs:ready,fps:+(f.frames/(f.ms/1000)).toFixed(1),calls:f.calls}));
}
try{await Promise.race([b.close(),new Promise(r=>setTimeout(r,2000))]);}catch(e){}
process.exit(0);
