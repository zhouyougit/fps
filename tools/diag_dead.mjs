
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1000,height:560} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(1200);
await page.evaluate(()=>{ window.__G.player.damage(999,null); });
for (const t of [2,6,12,20,30]) {
  await page.waitForTimeout(t===2?2000:6000);
  console.log(t, JSON.stringify(await page.evaluate(()=>{
    const s=document.querySelector('.m-screen[data-s="dead"]');
    return {state:window.__G.game.state, screen:window.__G.game.menus.screen, cls:s&&s.className, disp:s&&getComputedStyle(s).display, rect:(()=>{const b=document.querySelector('[data-act="retry"]'); const r=b.getBoundingClientRect(); return [r.x,r.y,r.width,r.height];})()};
  })));
}
await browser.close();
