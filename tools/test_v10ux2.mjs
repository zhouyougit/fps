
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
await page.waitForTimeout(2000);
console.log('step1', await page.evaluate(()=>{ window.__SX.armoryOpen(); return !!document.querySelector('.x-armory'); }));
await page.waitForTimeout(400);
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
console.log('armory', JSON.stringify(await page.evaluate(()=>({open:document.querySelector('.x-armory').classList.contains('on'), title:document.querySelector('.x-ar-panel h2').textContent, close:document.querySelector('.x-ar-actions [data-x="close"]').textContent}))));
await page.evaluate(()=>{ const G=window.__G,S=window.__SX; S.save(); G.player.damage(999,null); });
await page.waitForTimeout(2500);
console.log('dead', JSON.stringify(await page.evaluate(()=>{
  const cp=document.querySelector('.x-cp'), retry=document.querySelector('[data-act="retry"]');
  return {state:window.__G.game.state, cp:!!cp, cpPrimary:cp&&cp.classList.contains('primary'), retryPrimary:retry&&retry.classList.contains('primary'), cls:retry&&retry.className};
})));
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-4).join('\n'));
await browser.close();
