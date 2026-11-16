
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:900,height:500} });
const logs=[]; page.on('console',m=>{ if(m.type()==='warning'||m.type()==='error') logs.push('['+m.type()+'] '+m.text()); });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(800);
for (const i of [0,1,2]) {
  const res = await page.evaluate((idx)=>{
    const G=window.__G; window.__SX.applyMission(idx); G.game.start({skipIntro:true});
    return {mission:idx, start:G.level.playerStart.pos.toArray().map(v=>+v.toFixed(2)), list:window.__SX.validateObjectives(), relays:G.level.objectives.map(o=>({id:o.id,pos:o.pos.toArray().map(v=>+v.toFixed(2))}))};
  }, i);
  console.log(JSON.stringify(res,null,1));
}
console.log(logs.slice(-6).join('\n'));
await browser.close();
