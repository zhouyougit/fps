
import { chromium } from 'playwright';
const b=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files']});
const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto('file:///Users/zhouyou/codex_workspace/fps/versions/几猫_V38.html?q=low&noaudio=1',{waitUntil:'load',timeout:240000});
await p.waitForFunction(()=>window.__ready===true&&window.__SX,null,{timeout:420000});
await p.waitForTimeout(1500);
await p.screenshot({path:'versions/screens/v38_title.png',timeout:120000});
await p.evaluate(()=>{const G=window.__G;window.__SX.applyMission(6);G.game.start({skipIntro:true});G.player.pos.set(24,0,18);G.player.yaw=2.4;G.player.pitch=0.02;});
await p.waitForTimeout(2200);
await p.screenshot({path:'versions/screens/v38_m7.png',timeout:120000});
console.log(JSON.stringify(await p.evaluate(()=>({state:window.__G.game.state,mission:window.__G.game.currentMission&&window.__G.game.currentMission.id,err:(window.__errors||[]).slice(0,3)}))));
try{await Promise.race([b.close(),new Promise(r=>setTimeout(r,3000))]);}catch(e){}
process.exit(0);
