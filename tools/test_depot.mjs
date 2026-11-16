
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(1000);
console.log('maps', JSON.stringify(await page.evaluate(()=>({maps:window.__SX.maps(), id:window.__SX.mapId()}))));
const res = await page.evaluate(()=>{
  const G=window.__G;
  const t0=performance.now();
  const ok=window.__SX.switchMap('depot');
  const t1=performance.now();
  G.game.start({skipIntro:true});
  return {ok, ms:+(t1-t0).toFixed(1), boxes:G.physics.boxes.length, start:G.level.playerStart.pos.toArray().map(v=>+v.toFixed(2)), relays:Object.keys(window.__SX.mapRelays('depot')||{}), walk:G.physics.nav.isWalkable(0,13.6), gh:+G.physics.groundHeight(0,13.6,5).toFixed(2)};
});
await page.waitForTimeout(3000);
console.log(JSON.stringify(res), JSON.stringify(await page.evaluate(()=>({calls:window.__G.render.stats().calls,tris:window.__G.render.stats().tris,children:window.__G.scene.children.length,err:(window.__errors||[]).slice(0,3)}))));
await page.screenshot({path:'tools/depot_v15.png',timeout:120000});
console.log(errs.slice(0,4));
await browser.close();
