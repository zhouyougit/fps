
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:1024,height:576} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('http://127.0.0.1:3311/game.html?shot=1&autostart=1&q=low',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
await page.waitForTimeout(2500);
console.log('boot', JSON.stringify(await page.evaluate(()=>({ext:!!window.__SX, state:window.__G.game.state, sx: window.__SX && window.__SX.state()}))));
await page.screenshot({path:'tools/v2_0.png',timeout:120000});
// walk toward a pickup, test grenade + melee
console.log('act', JSON.stringify(await page.evaluate(()=>{
  const S=window.__SX, G=S.G;
  S.god();
  const before={hp:G.player.health,armor:G.player.armor,gren:S.grenades};
  S.pickup(0);
  const after={hp:G.player.health,armor:G.player.armor,gren:S.grenades, taken:S.S.pickups[0].taken};
  S.throwGrenade();
  const gren={n:S.S.grenadeList.length};
  S.melee();
  // teleport near objective to test checkpoint
  G.player.pos.set(3,0,9); G.player.yaw=Math.PI;
  S.save();
  return {before,after,gren,cp:!!S.S.checkpoint, state:S.state()};
})));
await page.waitForTimeout(3000);
await page.screenshot({path:'tools/v2_1.png',timeout:120000});
console.log('after', JSON.stringify(await page.evaluate(()=>({sx:window.__SX.state(),err:(window.__errors||[]).slice(0,5),fps:window.__stats().fps}))));
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-12).join('\n'));
await browser.close();
