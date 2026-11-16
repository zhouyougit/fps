
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
await page.waitForTimeout(1000);
// enter training via API? use launchFast? Training uses launchTraining; expose via mission screen click or use __SX? Not exposed. Use UI:
await page.evaluate(()=>{ window.__SX.unlockAll(); window.__SX.openMissions(); });
await page.waitForTimeout(400);
const card = await page.locator('.x-train-card').boundingBox();
await page.mouse.click(card.x+card.width/2, card.y+card.height/2);
await page.waitForTimeout(200);
const go = await page.locator('.x-camp-actions [data-x="go"]').boundingBox();
await page.mouse.click(go.x+go.width/2, go.y+go.height/2);
await page.waitForTimeout(2500);
const p0 = await page.evaluate(()=>{
  const G=window.__G, list=G.enemies.list.filter(e=>e.alive&&e.trainTarget);
  return list.map(e=>({id:e.id,pos:[+e.pos.x.toFixed(2),+e.pos.y.toFixed(2),+e.pos.z.toFixed(2)],home:[+e.home.x.toFixed(1),+e.home.z.toFixed(1)],ring:!!(e.__trainRing&&e.__trainRing.visible),vel:+e.vel.length().toFixed(2)}));
});
console.log('t0', JSON.stringify(p0));
await page.waitForTimeout(6000);
const p1 = await page.evaluate(()=>{
  const G=window.__G, list=G.enemies.list.filter(e=>e.alive&&e.trainTarget);
  return {targets:list.map(e=>({id:e.id,pos:[+e.pos.x.toFixed(2),+e.pos.y.toFixed(2),+e.pos.z.toFixed(2)],val:+e.vel.length().toFixed(2),rot:e.__trainRing?+e.__trainRing.rotation.z.toFixed(2):null})), score:window.__SX.S.training.score};
});
console.log('t1', JSON.stringify(p1));
await page.screenshot({path:'tools/v9_targets.png',timeout:120000});
// kill one
const kill = await page.evaluate(()=>{
  const G=window.__G, e=G.enemies.list.find(x=>x.alive&&x.trainTarget);
  const before={alive:e.alive,score:window.__SX.S.training.score};
  e.damage(999, e.pos, new G.THREE.Vector3(0,0,1), 'body');
  return {before, afterAlive:e.alive, active:e.active, score:window.__SX.S.training.score};
});
await page.waitForTimeout(800);
console.log('kill', JSON.stringify(kill), JSON.stringify(await page.evaluate(()=>({score:window.__SX.S.training.score,kills:window.__SX.S.training.kills,aliveTargets:window.__G.enemies.list.filter(e=>e.alive&&e.trainTarget).length,err:(window.__errors||[]).slice(0,3)}))));
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-5).join('\n'));
await browser.close();
