
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:180000});
await page.waitForTimeout(1500);
// spawn 3 enemies near
console.log('spawn', JSON.stringify(await page.evaluate(()=>{
  const G=window.__G,T=G.THREE,S=window.__SX;
  S.god();
  G.player.pos.set(-19,0,9); G.player.yaw=0;
  G.enemies.clear();
  const list=[['hound',-19,0,4],['hound',-16,0,5],['gull',-19,6,3]];
  for(const [t,x,y,z] of list) G.enemies.spawn(t, new T.Vector3(x,y,z), {state:'alert', passive:true});
  return {count:G.enemies.aliveCount()};
})));
await page.waitForTimeout(800);
// scan via Q
await page.keyboard.press('KeyQ');
await page.waitForTimeout(1200);
console.log('scan', JSON.stringify(await page.evaluate(()=>({
  marks:window.__SX.marks(), cd:window.__SX.scanCd(),
  els:document.querySelectorAll('.x-sm').length,
  pulse:document.querySelector('.x-scan-pulse').className,
  msg:document.querySelector('.h-msg') && document.querySelector('.h-msg').textContent
}))));
await page.screenshot({path:'tools/v6_scan.png',timeout:120000});
// grenade aim: hold G
await page.keyboard.down('KeyG');
await page.waitForTimeout(1500);
console.log('aim', JSON.stringify(await page.evaluate(()=>({aim:window.__SX.arc(), grenades:window.__SX.S.grenades}))));
await page.screenshot({path:'tools/v6_arc.png',timeout:120000});
await page.keyboard.up('KeyG');
await page.waitForTimeout(1500);
console.log('release', JSON.stringify(await page.evaluate(()=>({aim:window.__SX.arc(), grenades:window.__SX.S.grenades, live:window.__SX.S.grenadeList.length}))));
// kill streak: two kills
console.log('streak', JSON.stringify(await page.evaluate(async ()=>{
  const G=window.__G;
  const list=G.enemies.list.filter(e=>e.alive).slice(0,2);
  for(const e of list){ e.damage(9999, e.pos, new G.THREE.Vector3(0,0,1), 'body'); }
  await new Promise(r=>setTimeout(r,300));
  return {warn:document.querySelector('.h-warn') && document.querySelector('.h-warn').textContent, cls:document.querySelector('.h-warn') && document.querySelector('.h-warn').className, kills:G.combat.stats.kills};
})));
await page.waitForTimeout(600);
await page.screenshot({path:'tools/v6_streak.png',timeout:120000});
console.log(JSON.stringify(await page.evaluate(()=>({err:(window.__errors||[]).slice(0,5)}))));
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-8).join('\n'));
await browser.close();
