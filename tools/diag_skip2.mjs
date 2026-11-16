
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:900,height:500} });
const errs=[]; page.on('pageerror',e=>errs.push(e.message)); page.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(1000);
await page.evaluate(()=>window.__SX.unlockAll());
async function click(sel){ const b=await page.locator(sel).first().boundingBox(); if(!b) return false; await page.mouse.click(b.x+b.width/2,b.y+b.height/2); return true; }
await click('[data-x="campaign"]'); await page.waitForTimeout(300);
await click('.x-mcard[data-idx="1"]'); await page.waitForTimeout(200);
await click('.x-camp-actions [data-x="go"]'); await page.waitForTimeout(400);
console.log('brief', await page.evaluate(()=>({brief:document.querySelector('.x-brief').classList.contains('on'), state:window.__G.game.state})));
await click('.x-br-actions [data-x="brief-go"]'); await page.waitForTimeout(300);
console.log('afterGo', await page.evaluate(()=>window.__G.game.state));
await page.evaluate(()=>window.__G.game.start({skipIntro:true}));
console.log('afterSkip', await page.evaluate(()=>window.__G.game.state));
await page.waitForTimeout(1000);
console.log('after1s', await page.evaluate(()=>window.__G.game.state));
await page.waitForTimeout(2000);
console.log('after3s', await page.evaluate(()=>window.__G.game.state), errs.slice(0,3));
await browser.close();
