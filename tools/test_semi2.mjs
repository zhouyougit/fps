
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:800,height:450} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('http://127.0.0.1:3311/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:180000});
await page.waitForTimeout(1200);
console.log(JSON.stringify(await page.evaluate(()=>{
  const G=window.__G;
  G.weapon.select(2);
  const out={idx:G.weapon.activeIndex, name:G.weapon.name, state:G.weapon.state, ammo:G.weapon.ammo, semi:G.weapon.scope};
  // manual update with fire on
  G.input.fire = true;
  for(let i=0;i<6;i++) G.weapon.update(0.1);
  G.input.fire = false;
  out.after={ammo:G.weapon.ammo, shots:G.combat.stats.shots, state:G.weapon.state};
  return out;
})));
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-4).join('\n'));
await browser.close();
