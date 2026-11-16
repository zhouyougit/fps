
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const p0=await browser.newPage({ viewport:{width:1280,height:720} });
await p0.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await p0.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await p0.waitForTimeout(800);
await p0.evaluate(()=>window.__MP.open());
await p0.waitForTimeout(500);
await p0.screenshot({path:'tools/v16_lobby.png',timeout:120000});
console.log('lobby', JSON.stringify(await p0.evaluate(()=>({on:document.querySelector('.x-mp').classList.contains('on'), url:document.querySelector('[data-mp-url]').value, btn:document.querySelector('[data-mp-join]').textContent}))));
await browser.close();
