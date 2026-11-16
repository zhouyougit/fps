
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:800,height:450} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('http://127.0.0.1:3311/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:180000});
await page.waitForTimeout(1500);
const setup = await page.evaluate(async ()=>{
  const G=window.__G,T=G.THREE;
  G.enemies.clear();
  G.player.pos.set(-19,0,9); G.player.yaw=0; G.player.pitch=0; G.player.health=100; G.player.armor=0; G.player.invulnerable=false;
  await new Promise(r=>setTimeout(r,400));
  const e=G.enemies.spawn('elite', new T.Vector3(-19,0,4), {state:'alert', target:G.player.pos});
  return {spawned:!!e, eye:G.player.eye.toArray().map(v=>+v.toFixed(1))};
});
console.log('setup', JSON.stringify(setup));
for (let i=0;i<6;i++){
  await page.waitForTimeout(5000);
  const st = await page.evaluate(()=>{
    const G=window.__G,e=G.enemies.list.find(x=>x.alive&&x.variant==='elite');
    return {hp:G.player.health, es:e&&e.es, mode:e&&e.mode, dist:e?+e.pos.distanceTo(G.player.pos).toFixed(1):null, t:+G.time.t.toFixed(1)};
  });
  console.log('t'+i, JSON.stringify(st));
}
await page.screenshot({path:'tools/v4_elite.png',timeout:120000});
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-5).join('\n'));
await browser.close();
