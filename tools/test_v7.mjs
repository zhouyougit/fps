
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:180000});
await page.waitForTimeout(1200);
async function click(sel){
  const b = await page.locator(sel).first().boundingBox();
  if (!b) return false;
  await page.mouse.click(b.x + b.width/2, b.y + b.height/2);
  return true;
}
await page.evaluate(()=>window.__SX.unlockAll());
await click('[data-x="campaign"]');
await page.waitForTimeout(400);
console.log('cards', await page.locator('.x-mcard').count());
await page.screenshot({path:'tools/v7_missions.png',timeout:120000});
await click('.x-train-card');
await page.waitForTimeout(300);
await click('.x-camp-actions [data-x="go"]');
await page.waitForTimeout(2500);
console.log('launched', JSON.stringify(await page.evaluate(()=>({
  state:window.__G.game.state, training:!!window.__SX.S.training && window.__SX.S.training.active,
  hud:document.querySelector('.x-train-hud').className, t:window.__SX.S.training && window.__SX.S.training.t.toFixed(1),
  targets:window.__G.enemies.list.filter(e=>e.alive&&e.trainTarget).length,
  obj:document.querySelector('.h-obj-t').textContent,
  relays:document.querySelector('.h-relays').style.display,
  inv:window.__G.player.invulnerable,
  err:(window.__errors||[]).slice(0,4)
}))));
await page.screenshot({path:'tools/v7_train.png',timeout:120000});
// kill one target
console.log('kill', JSON.stringify(await page.evaluate(()=>{
  const G=window.__G, tr=window.__SX.S.training;
  const e=G.enemies.list.find(x=>x.alive&&x.trainTarget);
  const s0=tr.score;
  e.damage(999, e.pos, new G.THREE.Vector3(0,0,1), 'body');
  return {scoreBefore:s0, kills:tr.kills};
})));
await page.waitForTimeout(800);
console.log('score', JSON.stringify(await page.evaluate(()=>({score:window.__SX.S.training.score, kills:window.__SX.S.training.kills, best:window.__SX.campaign().best.train||null}))));
// force finish
await page.evaluate(()=>{ window.__SX.S.training.t = 0.01; });
await page.waitForTimeout(1500);
console.log('result', JSON.stringify(await page.evaluate(()=>({
  active:window.__SX.S.training.active, state:window.__G.game.state,
  overlay:document.querySelector('.x-train-result').className,
  score:document.querySelector('.x-tr-score b').textContent,
  acc:document.querySelector('[data-f="acc"]').textContent,
  best:window.__SX.campaign().best.train||null
}))));
await page.screenshot({path:'tools/v7_result.png',timeout:120000});
// retry
await click('.x-tr-actions [data-x="again"]');
await page.waitForTimeout(2500);
console.log('retry', JSON.stringify(await page.evaluate(()=>({active:window.__SX.S.training.active, t:window.__SX.S.training.t.toFixed(1), state:window.__G.game.state, result:document.querySelector('.x-train-result').className, hud:document.querySelector('.x-train-hud').className}))));
// finish and back to title
await page.evaluate(()=>{ window.__SX.S.training.t = 0.01; });
await page.waitForTimeout(1200);
await click('.x-tr-actions [data-x="back"]');
await page.waitForTimeout(1200);
console.log('title', JSON.stringify(await page.evaluate(()=>({state:window.__G.game.state, screen:window.__G.game.menus.screen, hud:document.querySelector('.x-train-hud').className, obj:window.__G.level.objectives.length, err:(window.__errors||[]).slice(0,4)}))));
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-8).join('\n'));
await browser.close();
