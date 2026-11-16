
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
for (const v of ['V2','V3']) {
  const page = await browser.newPage({ viewport:{width:800,height:450} });
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('http://127.0.0.1:3311/versions/%E5%87%A0%E7%8C%AB_'+v+'.html?q=low&noaudio=1',{waitUntil:'load',timeout:180000});
  await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:180000});
  await page.waitForTimeout(1200);
  const info = await page.evaluate(()=>({
    profile:window.__SX_PROFILE, campaignUI:!!document.querySelector('.x-camp'),
    campaignBtn:!!document.querySelector('[data-x="campaign"]'),
    bossBar:!!document.querySelector('.x-boss'),
    mission:window.__G.game.currentMission && window.__G.game.currentMission.id,
    m3:window.__G.game.currentMission? null : null,
    err:(window.__errors||[]).slice(0,4)
  }));
  console.log(v, JSON.stringify(info), 'pageerr', errs.slice(0,2));
  await page.close();
}
await browser.close();
