
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
await page.goto('file:///Users/zhouyou/codex_workspace/fps/versions/%E5%87%A0%E7%8C%AB_V14.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:240000});
await page.waitForTimeout(1200);
await page.evaluate(()=>window.__G.game.start({skipIntro:true}));
await page.waitForTimeout(800);
await page.keyboard.press('Escape');
await page.waitForTimeout(1000);
const btn = page.locator('.m-screen[data-s="paused"] .m-actions button', {hasText:'设置'}).first();
if (await btn.count()) await btn.click();
await page.waitForTimeout(800);
await page.screenshot({path:'tools/v14_settings.png',timeout:120000});
console.log(JSON.stringify(await page.evaluate(()=>({profile:window.__SX_PROFILE, ready:window.__ready, err:(window.__errors||[]).slice(0,3), panel:!!document.querySelector('.panel.on'), heads:[...document.querySelectorAll('.panel-b h3')].map(x=>x.textContent)})), null, 0), errs.slice(0,2));
await browser.close();
