
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:1024,height:576} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('http://127.0.0.1:3311/game.html?q=low&noaudio=1&autostart=1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:180000});
await page.waitForTimeout(1500);
console.log('m1', JSON.stringify(await page.evaluate(()=>window.__SX.campaign())));
// launch mission 2
await page.evaluate(()=>window.__SX.launch(1));
await page.waitForTimeout(6000);
console.log('m2', JSON.stringify(await page.evaluate(()=>({c:window.__SX.campaign(), state:window.__G.game.state, rain:window.__G.ground.rainLevel, exp:window.__G.render.exposure, sat:window.__G.render.post.saturation, err:(window.__errors||[]).slice(0,6)}))));
await page.screenshot({path:'tools/v3_m2.png',timeout:120000});
// cut all relays in m2
await page.evaluate(()=>{ window.__SX.god(); window.__SX.cutAll(); });
await page.waitForTimeout(5000);
console.log('m2cut', JSON.stringify(await page.evaluate(()=>({c:window.__SX.campaign(), run:{cut:window.__G.game.run.cut, all:window.__G.game.run.allCut, evac:window.__G.game.run.evacT}, state:window.__G.game.state}))));
await page.screenshot({path:'tools/v3_m2cut.png',timeout:120000});
// launch mission 3 and check evac hold
await page.evaluate(()=>window.__SX.launch(2));
await page.waitForTimeout(6000);
await page.evaluate(()=>{ window.__SX.god(); window.__SX.cutAll(); });
await page.waitForTimeout(3000);
console.log('m3', JSON.stringify(await page.evaluate(()=>({c:window.__SX.campaign(), run:{cut:window.__G.game.run.cut, all:window.__G.game.run.allCut, evac:window.__G.game.run.evacT}, obj:document.querySelector('.h-obj-t')&&document.querySelector('.h-obj-t').textContent, err:(window.__errors||[]).slice(0,6)}))));
await page.screenshot({path:'tools/v3_m3evac.png',timeout:120000});
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-8).join('\n'));
await browser.close();
