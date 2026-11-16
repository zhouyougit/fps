
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:800,height:450} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('file:///Users/zhouyou/codex_workspace/fps/versions/%E5%87%A0%E7%8C%AB_V5.html?q=low&noaudio=1',{waitUntil:'load',timeout:180000});
let ready=true;
try { await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:120000}); } catch(e){ ready=false; }
console.log(JSON.stringify(await page.evaluate(()=>({ready:window.__ready, fatal:window.__fatal, state:window.__G&&window.__G.game.state, err:(window.__errors||[]).slice(0,4)})).catch(e=>({e:String(e)}))), ready);
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-6).join('\n'));
await browser.close();
