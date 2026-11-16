
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
await page.waitForTimeout(1000);
await page.evaluate(()=>{
  const G=window.__G,T=G.THREE,S=window.__SX;
  S.god(); G.enemies.clear();
  G.player.pos.set(10,0,25); G.player.yaw=0; G.player.pitch=0.03;
  G.enemies.spawn('heavy', new T.Vector3(8,0,19), {yaw:0});
  G.enemies.spawn('turret', new T.Vector3(11,0,19), {yaw:0});
  G.enemies.spawn('marksman', new T.Vector3(13.5,0,18), {yaw:0});
});
await page.waitForTimeout(3500);
await page.screenshot({path:'tools/v10_roster.png',timeout:120000});
console.log(JSON.stringify(await page.evaluate(()=>({
  list:window.__G.enemies.list.filter(e=>e.alive).map(e=>({v:e.variant,hp:e.hp,shield:e.shieldHp,es:e.es,mode:e.mode})),
  err:(window.__errors||[]).slice(0,3)
}))));
await browser.close();
