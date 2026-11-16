
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
await page.goto('file:///Users/zhouyou/codex_workspace/fps/versions/%E5%87%A0%E7%8C%AB_V5.html?q=low&noaudio=1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
await page.waitForTimeout(1200);
async function clickCenter(sel){
  const b = await page.locator(sel).first().boundingBox();
  if (!b) return false;
  await page.mouse.click(b.x + b.width/2, b.y + b.height/2);
  return true;
}
await page.evaluate(()=>window.__SX.unlockAll());
await clickCenter('[data-x="campaign"]');
await page.waitForTimeout(400);
await clickCenter('.x-mcard[data-idx="2"]');
await page.waitForTimeout(300);
console.log('selectedM3', JSON.stringify(await page.evaluate(()=>({cur:window.__SX.campaign().current, sel:[...document.querySelectorAll('.x-mcard.sel')].map(c=>c.dataset.idx), title:document.querySelector('.x-camp-actions [data-x="go"]').textContent}))));
await page.screenshot({path:'tools/fix_missions2.png',timeout:120000});
await clickCenter('.x-camp-actions [data-x="go"]');
await page.waitForTimeout(4000);
console.log('launched', JSON.stringify(await page.evaluate(()=>({state:window.__G.game.state, mission:window.__G.game.currentMission.id, overlay:document.querySelector('.x-camp').classList.contains('on'), obj:document.querySelector('.h-obj-t')&&document.querySelector('.h-obj-t').textContent, err:(window.__errors||[]).slice(0,3)}))));
console.log('pageerr', errs.slice(0,2));
await browser.close();
