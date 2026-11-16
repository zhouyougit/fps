
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const p=await browser.newPage({ viewport:{width:800,height:450} });
p.on('pageerror',e=>console.log('PAGEERROR', e.message));
p.on('console',m=>console.log('CONSOLE',m.type(),m.text().slice(0,300)));
await p.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
for(let i=0;i<6;i++){ await p.waitForTimeout(10000); console.log(i, JSON.stringify(await p.evaluate(()=>({ready:window.__ready, G:!!window.__G, state:window.__G&&window.__G.game&&window.__G.game.state, err:window.__errors&&window.__errors.length, boot:document.querySelector('.boot')&&document.querySelector('.boot').className})))); }
await browser.close();
