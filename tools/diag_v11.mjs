
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:900,height:500} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1',{waitUntil:'load',timeout:120000});
await page.waitForTimeout(45000);
console.log(JSON.stringify(await page.evaluate(()=>({ready:window.__ready, fatal:window.__fatal, err:(window.__errors||[]).slice(0,6), hasSX:!!window.__SX, brief:!!document.querySelector('.x-brief')})).catch(e=>({evalErr:String(e)}))));
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-15).join('\n'));
await browser.close();
