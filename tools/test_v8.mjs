
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:180000});
await page.waitForTimeout(1200);
console.log('boot', JSON.stringify(await page.evaluate(()=>({
  weapons:window.__G.weapon.list.map(w=>({id:w.id,mag:w.magSize,base:w.baseMag,mods:w.mods,ads:w.adsFov})),
  armory:!!window.__SX.armory(), err:(window.__errors||[]).slice(0,4)
}))));
await page.evaluate(()=>window.__SX.armoryOpen());
await page.waitForTimeout(500);
await page.screenshot({path:'tools/v8_armory.png',timeout:120000});
async function click(sel){ const loc=page.locator(sel).first(); const b=await loc.boundingBox(); if(!b) return false; await page.mouse.click(b.x+b.width/2,b.y+b.height/2); return true; }
console.log('open', await page.evaluate(()=>document.querySelector('.x-armory').classList.contains('on')));
// switch tab
await click('.x-ar-tab[data-wid="breaker12"]');
await page.waitForTimeout(300);
console.log('tab', JSON.stringify(await page.evaluate(()=>({tab:document.querySelector('.x-ar-tab.on').dataset.wid, opts:document.querySelectorAll('.x-ar-opt').length}))));
// choose extended tube
await click('.x-ar-opt[data-slot="mag"][data-opt="ext"]');
await page.waitForTimeout(300);
console.log('mag', JSON.stringify(await page.evaluate(()=>({magSize:window.__G.weapon.list.find(w=>w.id==='breaker12').magSize, saved:localStorage.getItem('saltline.armory.v1')}))));
// suppressor via API and check mesh
console.log('supp', JSON.stringify(await page.evaluate(()=>{
  const st=window.__SX.armorySet('pac9','muzzle','supp');
  const w=window.__G.weapon.list.find(w=>w.id==='pac9');
  return {st, damage:w.mods.damage, alert:w.mods.alert, muzzleVisible:!!(w.__sxMuzzle&&w.__sxMuzzle.visible)};
})));
await page.screenshot({path:'tools/v8_armory2.png',timeout:120000});
await click('.x-ar-actions [data-x="close"]');
await page.waitForTimeout(300);
// verify persisted after reload
await page.reload({waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
await page.waitForTimeout(1200);
console.log('reload', JSON.stringify(await page.evaluate(()=>({
  pac9:{muzzle:window.__SX.armory().pac9.muzzle, mag:window.__G.weapon.list.find(w=>w.id==='pac9').magSize, dmg:window.__G.weapon.list.find(w=>w.id==='pac9').mods.damage},
  breaker:window.__G.weapon.list.find(w=>w.id==='breaker12').magSize,
  dmr:window.__G.weapon.list.find(w=>w.id==='dmr').magSize
}))));
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-8).join('\n'));
await browser.close();
