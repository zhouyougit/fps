
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(1000);
const depot = await page.evaluate(()=>{
  const G=window.__G, t0=performance.now();
  window.__SX.applyMission(3); G.game.start({skipIntro:true});
  const t1=performance.now();
  return {ms:+(t1-t0).toFixed(1), map:window.__SX.mapId(), start:G.level.playerStart.pos.toArray().map(v=>+v.toFixed(2)),
    obj:G.level.objectives.map(o=>({id:o.id,pos:o.pos.toArray().map(v=>+v.toFixed(2)),vis:o.object.visible})),
    extract:G.level.extraction.pos.toArray().map(v=>+v.toFixed(2)), boxes:G.physics.boxes.length, spawns:G.level.enemySpawns.length,
    walk:G.physics.nav.isWalkable(0,13.6), valid:window.__SX.validateObjectives()};
});
await page.waitForTimeout(2500);
console.log(JSON.stringify(depot,null,1).slice(0,5000));
await page.screenshot({path:'tools/m4_depot.png',timeout:120000});
const back = await page.evaluate(()=>{
  const G=window.__G;
  window.__SX.applyMission(0); G.game.start({skipIntro:true});
  return {map:window.__SX.mapId(), start:G.level.playerStart.pos.toArray().map(v=>+v.toFixed(2)), obj:G.level.objectives.map(o=>o.id), boxes:G.physics.boxes.length, valid:window.__SX.validateObjectives()};
});
console.log('back', JSON.stringify(back).slice(0,3000));
console.log(errs.slice(0,4));
await browser.close();
