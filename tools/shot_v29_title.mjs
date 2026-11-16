
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page=await browser.newPage({ viewport:{width:1280,height:720} });
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(1200);
console.log(JSON.stringify(await page.evaluate(()=>({state:window.__G.game.state, ver:(document.querySelector('.m-ver')||{}).textContent, err:window.__errors&&window.__errors.length}))));
await page.screenshot({path:'tools/v29_title.png',timeout:120000});
await browser.close();
