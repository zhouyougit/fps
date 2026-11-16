
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:800,height:450} });
await page.goto('http://127.0.0.1:3311/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
await page.waitForTimeout(1500);
console.log(JSON.stringify(await page.evaluate(()=>{
  const G=window.__G;
  G.weapon.select(2);
  G.input.fire=true;
  const seq=[];
  for(let i=0;i<14;i++){ G.weapon.update(0.1); seq.push([G.weapon.list[2].ammo, G.weapon.list[2].state, G.weapon.list[2].root.visible]); }
  G.input.fire=false;
  return {seq, shots:G.combat.stats.shots, visible:G.weapon.list[2].root.visible, idx:G.weapon.activeIndex};
})));
await browser.close();
