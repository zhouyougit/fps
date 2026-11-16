
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:800,height:450} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(1000);
for (const i of [0,1,2]) {
  console.log('---', i, JSON.stringify(await page.evaluate((idx)=>{
    const G=window.__G;
    window.__SX.applyMission(idx);
    const L=G.level;
    const before={ps:{pos:L.playerStart.pos.toArray().map(v=>+v.toFixed(2)),yaw:+L.playerStart.yaw.toFixed(2)}, orig:L.__origStart?{pos:L.__origStart.pos.toArray().map(v=>+v.toFixed(2)),yaw:L.__origStart.yaw}:null};
    G.game.start({skipIntro:true});
    return {before, after:{pos:G.player.pos.toArray().map(v=>+v.toFixed(2)),yaw:+G.player.yaw.toFixed(2)}, psNow:{pos:L.playerStart.pos.toArray().map(v=>+v.toFixed(2)),yaw:+L.playerStart.yaw.toFixed(2)}, gh:+G.physics.groundHeight(-10,-20,3).toFixed(2), gh10:+G.physics.groundHeight(-10,-20,10).toFixed(2)};
  }, i)));
  await page.waitForTimeout(600);
}
await browser.close();
