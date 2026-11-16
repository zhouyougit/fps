
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const p=await browser.newPage({ viewport:{width:1280,height:720} });
await p.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await p.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await p.waitForTimeout(600);
await p.evaluate(()=>window.__MP.join('ws://172.16.17.189:9100','A','shot-'+Date.now(),'core'));
await new Promise(r=>setTimeout(r,3500));
await p.screenshot({path:'tools/v25_core_spawn.png',timeout:120000});
console.log(JSON.stringify(await p.evaluate(()=>({pos:window.__G.player.pos.toArray().map(v=>+v.toFixed(1)), yaw:+window.__G.player.yaw.toFixed(2)}))));
await browser.close();
