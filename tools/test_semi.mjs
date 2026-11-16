
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:1024,height:576} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('http://127.0.0.1:3311/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:180000});
await page.waitForTimeout(1200);
await page.evaluate(()=>{ window.__G.weapon.select(2); });
await page.waitForTimeout(4000);
await page.keyboard.down('Enter');
await page.waitForTimeout(2500);
await page.keyboard.up('Enter');
await page.waitForTimeout(1500);
console.log('semi', JSON.stringify(await page.evaluate(()=>({ammo:window.__G.weapon.ammo, shots:window.__G.combat.stats.shots, state:window.__G.weapon.state}))));
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
console.log('semi2', JSON.stringify(await page.evaluate(()=>({ammo:window.__G.weapon.ammo, shots:window.__G.combat.stats.shots}))));
// scope screenshot with drag mode
await page.evaluate(()=>{ window.__G.input.mode='drag'; window.__G.input.locked=true; });
await page.mouse.move(512,288); await page.mouse.down({button:'right'});
await page.waitForTimeout(3500);
await page.screenshot({path:'tools/v5_scope2.png',timeout:120000});
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-5).join('\n'));
await browser.close();
