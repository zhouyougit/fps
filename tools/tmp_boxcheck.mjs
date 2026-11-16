
import { chromium } from 'playwright';
const b=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files']});
const p=await b.newPage({viewport:{width:800,height:480}});
await p.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:240000});
await p.waitForFunction(()=>window.__ready===true&&window.__SX,null,{timeout:420000});
const out=await p.evaluate(()=>{ const R={}; for(const id of ['harbor','depot','ship','core']){ try{ window.__SX.switchMap(id); R[id]=window.__G.physics.boxes.length; }catch(e){ R[id]='ERR '+e.message; } } return R; });
console.log(JSON.stringify(out));
const fs=await import('node:fs');
for(const id of ['harbor','depot','ship','core']){ const j=JSON.parse(fs.readFileSync('packages/data/maps/'+id+'.map.json','utf8')); console.log(id,'data',j.boxes.length); }
try{ await Promise.race([b.close(),new Promise(r=>setTimeout(r,2000))]); }catch(e){}
process.exit(0);
