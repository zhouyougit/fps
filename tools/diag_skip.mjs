
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:900,height:500} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(1000);
console.log('s0', await page.evaluate(()=>window.__G.game.state));
// direct start skip from title
await page.evaluate(()=>window.__G.game.start({skipIntro:true}));
console.log('s1', await page.evaluate(()=>window.__G.game.state));
await page.waitForTimeout(1500);
console.log('s2', await page.evaluate(()=>window.__G.game.state));
// now via briefing
await page.evaluate(()=>window.__SX.unlockAll());
await page.evaluate(()=>window.__G.game.menus.show('none'));
await page.evaluate(()=>{ window.__SX.openMissions(); });
await page.waitForTimeout(300);
const b=await page.locator('.x-mcard[data-idx="1"]').boundingBox(); await page.mouse.click(b.x+b.width/2,b.y+b.height/2);
await page.waitForTimeout(200);
const g=await page.locator('.x-camp-actions [data-x="go"]').boundingBox(); await page.mouse.click(g.x+g.width/2,g.y+g.height/2);
await page.waitForTimeout(400);
console.log('b1', await page.evaluate(()=>window.__G.game.state));
await page.evaluate(()=>window.__G.game.start({skipIntro:true}));
console.log('b2', await page.evaluate(()=>window.__G.game.state));
await page.waitForTimeout(1500);
console.log('b3', await page.evaluate(()=>window.__G.game.state));
await page.waitForTimeout(3000);
console.log('b4', await page.evaluate(()=>window.__G.game.state));
await browser.close();
