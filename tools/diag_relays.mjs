
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:900,height:500} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(800);
console.log(JSON.stringify(await page.evaluate(()=>{
  const G=window.__G, P=G.physics;
  window.__SX.applyMission(1); G.game.start({skipIntro:true});
  const start=G.level.playerStart.pos;
  return {start:start.toArray().map(v=>+v.toFixed(2)), relays:G.level.objectives.map(o=>({
    id:o.id, pos:o.pos.toArray().map(v=>+v.toFixed(2)),
    walk:P.nav.isWalkable(o.pos.x,o.pos.z),
    floor2:+P.groundHeight(o.pos.x,o.pos.z,2.5).toFixed(2),
    floor10:+P.groundHeight(o.pos.x,o.pos.z,10).toFixed(2),
    path:(()=>{try{const p=P.nav.findPath(start,o.pos); return p?p.length:null;}catch(e){return 'err';}})()
  })), extract:{pos:G.level.extraction.pos.toArray().map(v=>+v.toFixed(2)), walk:P.nav.isWalkable(G.level.extraction.pos.x,G.level.extraction.pos.z)}};
}),null,1).slice(0,6000));
await browser.close();
