
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('http://127.0.0.1:3311/versions/%E5%87%A0%E7%8C%AB_V5.html?q=low&noaudio=1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:180000});
await page.waitForTimeout(1500);
await page.evaluate(()=>window.__SX.unlockAll());
await page.screenshot({path:'tools/final_title.png',timeout:120000});
await page.evaluate(()=>window.__SX.openMissions());
await page.waitForTimeout(600);
await page.screenshot({path:'tools/final_missions.png',timeout:120000});
// launch m3 fast, check boss
await page.evaluate(()=>{ window.__SX.launchFast(2); });
await page.waitForTimeout(3000);
await page.evaluate(()=>{ window.__SX.god(); window.__SX.cutAll(); });
await page.waitForTimeout(5000);
const st = await page.evaluate(()=>({
  state:window.__G.game.state, mission:window.__G.game.currentMission.id,
  boss:!!window.__G.enemies.list.find(e=>e.boss), bossAlive:window.__G.game.run.bossAlive,
  weapons:window.__G.weapon.list.map(w=>w.short), obj:document.querySelector('.h-obj-t').textContent,
  err:(window.__errors||[]).slice(0,5)
}));
console.log(JSON.stringify(st,null,1));
await page.screenshot({path:'tools/final_boss.png',timeout:120000});
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-6).join('\n'));
await browser.close();
