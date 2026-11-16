
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:180000});
await page.waitForTimeout(1200);
console.log('boot', JSON.stringify(await page.evaluate(()=>({
  segs:document.querySelectorAll('[data-x-seg]').length,
  diff:window.__SX.S.diffDamage, dmgScale:window.__SX.S.damageScale,
  cross:getComputedStyle(document.documentElement).getPropertyValue('--cross-col'),
  perf:!!document.querySelector('.x-perf'), err:(window.__errors||[]).slice(0,4)
}))));
// open settings via pause -> settings? easier: call apply via UI buttons in hidden panel
console.log('change', JSON.stringify(await page.evaluate(()=>{
  const S=window.__SX, G=S.G;
  const seg=document.querySelector('[data-x-seg="difficulty"]');
  const btn=seg.querySelector('button[data-v="nightmare"]');
  btn.click();
  const cross=document.querySelector('[data-x-seg="cross"] button[data-v="cyan"]'); cross.click();
  const shake=document.querySelector('[data-x-seg="shake"] button[data-v="high"]'); shake.click();
  G.player.armor=0; G.player.health=100;
  G.player.damage(10,null);
  return {diff:S.S.diffDamage, hp:G.player.health, shake:S.S.shakeScale, cross:getComputedStyle(document.documentElement).getPropertyValue('--cross-col'), saved:localStorage.getItem('saltline.access.v1'), pressed:[...seg.querySelectorAll('button')].filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.dataset.v)};
})));
// F3
await page.keyboard.press('F3');
await page.waitForTimeout(1200);
console.log('perf', JSON.stringify(await page.evaluate(()=>({on:document.querySelector('.x-perf').classList.contains('on'), text:document.querySelector('.x-perf pre').textContent}))));
await page.screenshot({path:'tools/v9_perf.png',timeout:120000});
// reload persistence
await page.reload({waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
await page.waitForTimeout(1200);
console.log('reload', JSON.stringify(await page.evaluate(()=>({
  diff:window.__SX.S.diffDamage, shake:window.__SX.S.shakeScale,
  cross:getComputedStyle(document.documentElement).getPropertyValue('--cross-col'),
  dmgScale:window.__SX.S.damageScale, err:(window.__errors||[]).slice(0,3)
}))));
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-6).join('\n'));
await browser.close();
