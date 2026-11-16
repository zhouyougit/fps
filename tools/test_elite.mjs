
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:800,height:450} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('http://127.0.0.1:3311/game.html?q=low&noaudio=1&autostart=1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:180000});
await page.waitForTimeout(1500);
console.log(JSON.stringify(await page.evaluate(async ()=>{
  const G=window.__G,T=G.THREE;
  G.enemies.clear();
  G.player.pos.set(-19,0,9); G.player.health=100; G.player.invulnerable=false;
  const e=G.enemies.spawn('elite', new T.Vector3(-19,0,4), {state:'alert', target:G.player.pos});
  let frames=0;
  for(let i=0;i<900;i++){ G.time.t += 0.05; G.enemies.update(0.05); frames++; if(!e.alive) break; }
  return {elite:{alive:e.alive,hp:e.hp,variant:e.variant,es:e.es,mode:e.mode}, hp:G.player.health, frames, err:(window.__errors||[]).slice(0,4)};
})));
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-5).join('\n'));
await browser.close();
