
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1000,height:560} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(800);
await page.evaluate(()=>{ const G=window.__G; window.__SX.applyMission(3); G.game.start({skipIntro:true}); window.__SX.god(); G.enemies.clear(); G.player.pos.set(-18,0.03,-13.8); G.player.yaw=Math.PI; });
await page.waitForTimeout(2500);
console.log('start', JSON.stringify(await page.evaluate(()=>({pos:window.__G.player.pos.toArray().map(v=>+v.toFixed(2)), yaw:+window.__G.player.yaw.toFixed(2), prompt:(document.querySelector('.h-prompt')||{}).textContent, dist:+window.__G.player.pos.distanceTo(window.__G.level.objectives[0].pos).toFixed(2)}))));
await page.keyboard.down('e');
for (let i=0;i<5;i++){ await page.waitForTimeout(3000); console.log(i, JSON.stringify(await page.evaluate(()=>({cut:window.__G.game.run.cut, pos:window.__G.player.pos.toArray().map(v=>+v.toFixed(2)), prompt:(document.querySelector('.h-prompt')||{}).textContent, cutT:window.__G.game.run.cutT, cutId:window.__G.game.run.cutId})))); }
await page.keyboard.up('e');
await browser.close();
