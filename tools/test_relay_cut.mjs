
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1000,height:560} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.evaluate(()=>{
  const G=window.__G;
  window.__SX.applyMission(1); G.game.start({skipIntro:true});
  window.__SX.god();
  G.player.pos.set(9,0.03,-20.2); G.player.yaw=0;
});
await page.waitForTimeout(2500);
console.log('before', JSON.stringify(await page.evaluate(()=>({cut:window.__G.game.run.cut, relays:window.__G.level.objectives.map(o=>({id:o.id,cut:o.cut}))}))));
await page.keyboard.down('e'); await page.waitForTimeout(14000); await page.keyboard.up('e');
await page.waitForTimeout(1000);
console.log('after', JSON.stringify(await page.evaluate(()=>({cut:window.__G.game.run.cut, relays:window.__G.level.objectives.map(o=>({id:o.id,cut:o.cut})), prompt:(document.querySelector('.h-prompt')||{}).textContent}))));
await browser.close();
