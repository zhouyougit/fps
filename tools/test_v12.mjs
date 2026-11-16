
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import fs from 'fs';

const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(1200);
const envs=[];
for (const i of [0,1,2]) {
  await page.evaluate((idx)=>{
    const G=window.__G;
    window.__SX.applyMission(idx);
    G.game.start({skipIntro:true});
    G.player.health=100;
  }, i);
  await page.waitForTimeout(1200);
  const sp = await page.evaluate(()=>({pos:window.__G.player.pos.toArray().map(v=>+v.toFixed(2)), yaw:+window.__G.player.yaw.toFixed(2)}));
  console.log('spawn', i, JSON.stringify(sp));
  await page.waitForTimeout(2000);
  await page.evaluate(()=>{ const G=window.__G; G.player.pos.set(10,0,22); G.player.yaw=0; G.player.pitch=0.05; });
  await page.waitForTimeout(600);
  envs.push(await page.evaluate(()=>window.__SX.environment()));
  await page.screenshot({path:'tools/v12_m'+i+'.png',timeout:120000});
  console.log('mission', i, JSON.stringify(envs[i]));
}
function meanDiff(a,b){
  const A=PNG.sync.read(fs.readFileSync(a)), B=PNG.sync.read(fs.readFileSync(b));
  let s=0,n=0;
  for (let i=0;i<A.data.length;i+=4){ s+=Math.abs(A.data[i]-B.data[i])+Math.abs(A.data[i+1]-B.data[i+1])+Math.abs(A.data[i+2]-B.data[i+2]); n+=3; }
  return s/n;
}
console.log('diff m0-m1', meanDiff('tools/v12_m0.png','tools/v12_m1.png').toFixed(2));
console.log('diff m0-m2', meanDiff('tools/v12_m0.png','tools/v12_m2.png').toFixed(2));
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-6).join('\n'));
await browser.close();
