
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:800,height:450} });
await page.goto('http://127.0.0.1:3311/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
await page.waitForTimeout(1500);
console.log(JSON.stringify(await page.evaluate(()=>{
  const G=window.__G, w=G.weapon.list[2];
  G.input.fire=true;
  const before={ammo:w.ammo, st:w.state, dbg:Object.assign({},w.debug), sprint:G.player.sprinting};
  const seq=[];
  for(let i=0;i<8;i++){ w.update(0.1); seq.push([w.ammo,w.state]); }
  G.input.fire=false;
  return {before, seq, shots:G.combat.stats.shots, playerSprint:G.player.sprinting, ads:G.player.ads};
})));
await browser.close();
