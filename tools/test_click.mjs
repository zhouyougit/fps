
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('file:///Users/zhouyou/codex_workspace/fps/versions/%E5%87%A0%E7%8C%AB_V5.html?q=low&noaudio=1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:180000});
await page.waitForTimeout(1200);
async function clickCenter(sel){
  const b = await page.locator(sel).first().boundingBox();
  if (!b) { console.log('NO BOX', sel); return false; }
  await page.mouse.click(b.x + b.width/2, b.y + b.height/2);
  return true;
}
// open mission screen via title button
await clickCenter('[data-x="campaign"]');
await page.waitForTimeout(500);
console.log('overlayOpen', await page.evaluate(()=>document.querySelector('.x-camp').classList.contains('on')));
// hover/click card 2 (locked) and card 1
await clickCenter('.x-mcard[data-idx="1"]');
await page.waitForTimeout(200);
console.log('afterLockedClick', await page.evaluate(()=>({current:window.__SX.campaign().current, sel:[...document.querySelectorAll('.x-mcard')].filter(c=>c.classList.contains('sel')).map(c=>c.dataset.idx)})));
await clickCenter('.x-mcard[data-idx="0"]');
await page.waitForTimeout(200);
// click 出动
await clickCenter('.x-camp-actions [data-x="go"]');
await page.waitForTimeout(1500);
console.log('afterGo', JSON.stringify(await page.evaluate(()=>({state:window.__G.game.state, overlay:document.querySelector('.x-camp').classList.contains('on'), screen:window.__G.game.menus.screen, mission:window.__G.game.currentMission.id, err:(window.__errors||[]).slice(0,4)}))));
await page.screenshot({path:'tools/fix_go.png',timeout:120000});
// reopen from pause? first wait playing
await page.waitForTimeout(6000);
await page.evaluate(()=>window.__SX.openMissions());
await page.waitForTimeout(400);
await clickCenter('.x-camp-actions [data-x="close"]');
await page.waitForTimeout(300);
console.log('closed', await page.evaluate(()=>document.querySelector('.x-camp').classList.contains('on')));
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-6).join('\n'));
await browser.close();
