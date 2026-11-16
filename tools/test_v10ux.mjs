
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
await page.waitForTimeout(2500);
console.log('hud', JSON.stringify(await page.evaluate(()=>({
  slots:document.querySelectorAll('.x-slot').length,
  hpVisible:getComputedStyle(document.querySelector('.h-health')).opacity,
  titleDim:(document.querySelector('.m-title .m-eyebrow .m-dim')||{}).textContent,
  debrief:{client:document.querySelector('.m-debrief .m-h').clientWidth, scroll:document.querySelector('.m-debrief .m-h').scrollWidth, text:document.querySelector('.m-debrief .m-h').textContent}
}))));
// mission screen selection
await page.evaluate(()=>{ window.__SX.unlockAll(); window.__SX.openMissions(); });
await page.waitForTimeout(400);
const tb = await page.locator('.x-train-card').boundingBox();
await page.mouse.click(tb.x+tb.width/2, tb.y+tb.height/2);
await page.waitForTimeout(300);
console.log('select', JSON.stringify(await page.evaluate(()=>({
  sel:[...document.querySelectorAll('.x-mcard.sel')].map(x=>x.dataset.idx||'train'),
  go:document.querySelector('.x-camp-actions [data-x="go"]').textContent,
  veil:getComputedStyle(document.querySelector('.x-camp-veil')).backgroundColor
}))));
await page.screenshot({path:'tools/v10_ui.png',timeout:120000});
// close mission screen
await page.evaluate(()=>{ document.querySelector('.x-camp [data-x="close"]').click(); });
// armory esc
await page.evaluate(()=>window.__SX.armoryOpen());
await page.waitForTimeout(300);
const open1 = await page.evaluate(()=>document.querySelector('.x-armory').classList.contains('on'));
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
const open2 = await page.evaluate(()=>document.querySelector('.x-armory').classList.contains('on'));
console.log('armoryEsc', JSON.stringify({open1,open2,title:document.querySelector('.x-ar-panel h2').textContent, closeBtn:document.querySelector('.x-ar-actions [data-x="close"]').textContent}));
// dead buttons + checkpoint
await page.evaluate(()=>{ const G=window.__G,S=window.__SX; S.save(); G.player.damage(999,null); });
await page.waitForTimeout(1500);
console.log('dead', JSON.stringify(await page.evaluate(()=>{
  const cp=document.querySelector('.x-cp'), retry=document.querySelector('[data-act="retry"]');
  return {cp:!!cp, cpPrimary:cp&&cp.classList.contains('primary'), retryPrimary:retry&&retry.classList.contains('primary'), retryClass:retry&&retry.className};
})));
// boss relays
await page.evaluate(()=>{ window.__SX.launchFast(2); });
await page.waitForTimeout(1500);
await page.evaluate(()=>{ window.__SX.god(); window.__SX.cutAll(); });
await page.waitForTimeout(3500);
console.log('bossRelays', JSON.stringify(await page.evaluate(()=>({display:document.querySelector('.h-relays').style.display, boss:!!window.__G.enemies.list.find(e=>e.boss)}))));
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-5).join('\n'));
await browser.close();
