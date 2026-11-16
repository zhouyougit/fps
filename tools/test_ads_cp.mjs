
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:1024,height:576} });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('http://127.0.0.1:3311/game.html?shot=1&autostart=1&q=low&noaudio=1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
await page.waitForTimeout(1000);
await page.evaluate(()=>{ window.__SX.god(); window.__G.player.invulnerable=false; window.__G.weapon.select(1); });
await page.waitForTimeout(5000);
await page.mouse.move(512,288);
await page.mouse.down({button:'right'});
await page.waitForTimeout(2500);
console.log('ads', JSON.stringify(await page.evaluate(()=>({ads:window.__G.weapon.ads, fov:window.__G.camera.fov, state:window.__G.weapon.state}))));
await page.screenshot({path:'tools/v2_ads.png',timeout:120000});
await page.mouse.up({button:'right'});
// checkpoint test
console.log('cp', JSON.stringify(await page.evaluate(()=>{
  const G=window.__G,S=window.__SX;
  S.save();
  G.player.damage(999, G.player.pos.clone());
  return {alive:G.player.alive, state:G.game.state, cp:!!S.S.checkpoint};
})));
await page.waitForTimeout(3500);
const dead = await page.evaluate(()=>({screen:window.__G.game.menus.screen, btn:!!document.querySelector('.m-dead .x-cp'), btnText:document.querySelector('.m-dead .x-cp')&&document.querySelector('.m-dead .x-cp').textContent}));
console.log('dead', JSON.stringify(dead));
const btn = await page.$('.m-dead .x-cp');
if (btn) { await btn.click(); await page.waitForTimeout(800); }
console.log('revived', JSON.stringify(await page.evaluate(()=>({alive:window.__G.player.alive, hp:window.__G.player.health, armor:window.__G.player.armor, state:window.__G.game.state, screen:window.__G.game.menus.screen, pos:window.__G.player.pos.toArray().map(v=>+v.toFixed(1))}))));
await browser.close();
