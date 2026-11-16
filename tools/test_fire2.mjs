
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:1024,height:576} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('http://127.0.0.1:3311/game.html?shot=1&autostart=1&q=low&noaudio=1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:180000});
await page.waitForTimeout(1000);
await page.evaluate(()=>{ window.__SX.god(); window.__G.weapon.select(1); window.__G.player.yaw=Math.PI; });
await page.waitForTimeout(5000);
console.log('pre', JSON.stringify(await page.evaluate(()=>({fire:window.__G.input.fire, state:window.__G.weapon.state, ammo:window.__G.weapon.ammo, enabled:window.__G.player.enabled, gameplay:window.__G.input.setGameplay?true:false}))));
await page.keyboard.down('Enter');
await page.waitForTimeout(2500);
await page.keyboard.up('Enter');
await page.waitForTimeout(800);
console.log('post', JSON.stringify(await page.evaluate(()=>({shots:window.__G.combat.stats.shots,hits:window.__G.combat.stats.hits,kills:window.__G.combat.stats.kills,ammo:window.__G.weapon.ammo,state:window.__G.weapon.state,err:(window.__errors||[]).slice(0,4)}))));
await page.screenshot({path:'tools/v2_fire.png',timeout:120000});
await browser.close();
