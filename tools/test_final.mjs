
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
await page.waitForTimeout(1000);
await page.evaluate(()=>window.__SX.launchFast(2));
await page.waitForTimeout(1500);
await page.evaluate(()=>{ window.__SX.god(); window.__SX.cutAll(); });
await page.waitForTimeout(3500);
console.log('boss', JSON.stringify(await page.evaluate(()=>{
  const G=window.__G,b=G.enemies.list.find(e=>e.boss);
  if(b) b.damage(99999,b.pos,new G.THREE.Vector3(0,0,1),'weak');
  return {hadBoss:!!b, state:G.game.state};
})));
await page.waitForTimeout(2500);
// teleport to extraction
await page.evaluate(()=>{ const G=window.__G,e=G.level.extraction.pos; G.player.pos.set(e.x,e.y+0.1,e.z); G.player.invulnerable=true; });
// wait for complete
let st='';
for(let i=0;i<12;i++){ await page.waitForTimeout(3000); st=await page.evaluate(()=>window.__G.game.state); if(st==='complete') break; }
await page.waitForTimeout(22000);
console.log('complete', JSON.stringify(await page.evaluate(()=>({
  state:window.__G.game.state, final:!!document.querySelector('.x-final'),
  finalText:(document.querySelector('.x-final')||{}).textContent,
  back:!!document.querySelector('.x-final-back'),
  screen:window.__G.game.menus.screen
}))));
await page.screenshot({path:'tools/v9_final.png',timeout:120000});
// click back
const bb=await page.locator('.x-final-back').first().boundingBox();
if(bb){ await page.mouse.click(bb.x+bb.width/2, bb.y+bb.height/2); await page.waitForTimeout(1500); }
console.log('back', JSON.stringify(await page.evaluate(()=>({state:window.__G.game.state, screen:window.__G.game.menus.screen, obj:window.__G.level.objectives.length, err:(window.__errors||[]).slice(0,3)}))));
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-6).join('\n'));
await browser.close();
