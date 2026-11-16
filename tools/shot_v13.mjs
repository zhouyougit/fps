
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(1000);
await page.evaluate(()=>{ window.__SX.unlockAll(); window.__SX.openMissions(); });
await page.waitForTimeout(500);
await page.screenshot({path:'tools/v13_cards.png',timeout:120000});
async function click(sel){ const b=await page.locator(sel).first().boundingBox(); if(!b) return false; await page.mouse.click(b.x+b.width/2,b.y+b.height/2); return true; }
await click('.x-mcard[data-idx="0"]'); await page.waitForTimeout(200);
await click('.x-camp-actions [data-x="go"]'); await page.waitForTimeout(400);
await page.screenshot({path:'tools/v13_brief.png',timeout:120000});
console.log(JSON.stringify(await page.evaluate(()=>({brief:document.querySelector('.x-brief').classList.contains('on'), rows:[...document.querySelectorAll('.x-br-chal li')].map(x=>x.textContent)}))));
await browser.close();
