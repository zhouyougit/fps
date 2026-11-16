
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:800,height:450} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('http://127.0.0.1:3311/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:180000});
await page.waitForTimeout(1500);
// play a bit: walk, fire, grenade, melee, switch
await page.keyboard.down('KeyW'); await page.waitForTimeout(3000); await page.keyboard.up('KeyW');
await page.keyboard.press('KeyG'); await page.waitForTimeout(3000);
await page.keyboard.press('KeyV'); await page.waitForTimeout(1000);
await page.keyboard.press('Digit2'); await page.waitForTimeout(3000);
await page.keyboard.down('Enter'); await page.waitForTimeout(3000); await page.keyboard.up('Enter');
await page.keyboard.press('KeyR'); await page.waitForTimeout(3000);
await page.keyboard.press('Digit1'); await page.waitForTimeout(2000);
const st = await page.evaluate(()=>({
  state:window.__G.game.state, hp:window.__G.player.health, armor:window.__G.player.armor,
  weapon:window.__G.weapon.name, ammo:window.__G.weapon.ammo, grenades:window.__SX.S.grenades,
  enemies:window.__G.enemies.aliveCount(), kills:window.__G.combat.stats.kills,
  errors:(window.__errors||[]).slice(0,8), fps:window.__stats().fps
}));
console.log(JSON.stringify(st,null,1));
await page.screenshot({path:'tools/v4_soak.png',timeout:120000});
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-10).join('\n'));
await browser.close();
