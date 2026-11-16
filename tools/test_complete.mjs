
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:1024,height:576} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('http://127.0.0.1:3311/game.html?q=low&noaudio=1&autostart=1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:180000});
await page.waitForTimeout(3000);
console.log('state0', await page.evaluate(()=>window.__G.game.state));
await page.evaluate(()=>{
  window.__SX.god();
  window.__SX.cutAll();
  const ex=window.__G.level.extraction.pos;
  window.__G.player.pos.set(ex.x, ex.y, ex.z);
});
await page.waitForTimeout(4000);
console.log('cut', JSON.stringify(await page.evaluate(()=>({state:window.__G.game.state, cut:window.__G.game.run.cut, all:window.__G.game.run.allCut, evac:window.__G.game.run.evacT}))));
// wait for complete
let st='';
for (let i=0;i<12;i++){ await page.waitForTimeout(5000); st = await page.evaluate(()=>window.__G.game.state); if(st==='complete') break; }
console.log('finalState', st);
await page.waitForTimeout(3000);
console.log('camp', JSON.stringify(await page.evaluate(()=>({c:window.__SX.campaign(), next:!!document.querySelector('.x-next'), nextText:(document.querySelector('.x-next')||{}).textContent, rating:(document.querySelector('[data-f="rating"]')||{}).textContent, scene:window.__G.game.menus.screen}))));
await page.screenshot({path:'tools/v3_complete.png',timeout:120000});
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-6).join('\n'));
await browser.close();
