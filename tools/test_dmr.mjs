
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:1024,height:576} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('http://127.0.0.1:3311/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:180000});
await page.waitForTimeout(1500);
console.log('armory', JSON.stringify(await page.evaluate(()=>({slots:window.__G.weapon.list.map(w=>[w.name,w.ammo,w.magSize,w.id]), err:(window.__errors||[]).slice(0,5)}))));
await page.evaluate(()=>window.__G.weapon.select(2));
await page.waitForTimeout(4000);
await page.screenshot({path:'tools/v5_dmr.png',timeout:120000});
// ADS via synthetic input: hold right mouse on canvas
await page.evaluate(()=>{ const G=window.__G; G.player.invulnerable=true; G.input.mode='drag'; G.input.locked=true; });
await page.mouse.move(512,288);
await page.mouse.down({button:'right'});
await page.waitForTimeout(4000);
console.log('ads', JSON.stringify(await page.evaluate(()=>({ads:window.__G.weapon.ads, fov:+window.__G.camera.fov.toFixed(1), scope:document.querySelector('.x-scope').className, modelVisible:window.__G.weapon.list[2].root.visible}))));
await page.screenshot({path:'tools/v5_scope.png',timeout:120000});
await page.mouse.up({button:'right'});
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-6).join('\n'));
await browser.close();
