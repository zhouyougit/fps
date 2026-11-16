
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const p=await browser.newPage({ viewport:{width:800,height:450} });
p.on('pageerror',e=>console.log('PAGEERROR', e.message, e.stack&&e.stack.split('\n')[1]));
p.on('console',m=>{ if(m.type()==='error') console.log('CONSOLE',m.text().slice(0,400)); });
await p.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await p.waitForTimeout(12000);
console.log('ready', await p.evaluate(()=>window.__ready), 'errors', await p.evaluate(()=>window.__errors));
await browser.close();
