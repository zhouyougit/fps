
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
await page.waitForTimeout(1000);
async function click(sel){ const b=await page.locator(sel).first().boundingBox(); if(!b) return false; await page.mouse.click(b.x+b.width/2,b.y+b.height/2); return true; }
await page.evaluate(()=>window.__SX.unlockAll());
await click('[data-x="campaign"]'); await page.waitForTimeout(300);
await click('.x-train-card'); await page.waitForTimeout(200);
await click('.x-camp-actions [data-x="go"]'); await page.waitForTimeout(2000);
await page.evaluate(()=>{ window.__SX.S.training.t=0.01; });
await page.waitForTimeout(1200);
const pts = await page.evaluate(()=>{
  const btn=document.querySelector('.x-tr-actions [data-x="again"]');
  const r=btn.getBoundingClientRect();
  const probe=(x,y)=>document.elementsFromPoint(x,y).slice(0,4).map(e=>e.tagName+'.'+(e.className||''));
  return {rect:[r.x,r.y,r.width,r.height],
    p1:probe(r.x+r.width/2,r.y+r.height/2),
    p2:probe(r.x+10,r.y+r.height/2),
    p3:probe(r.x+r.width-10,r.y+r.height/2),
    p4:probe(r.x+r.width/2,r.y+6),
    p5:probe(r.x+r.width/2,r.y+r.height-6),
    style:{display:getComputedStyle(btn).display, vis:getComputedStyle(btn).visibility, pe:getComputedStyle(btn).pointerEvents, pos:getComputedStyle(btn).position}
  };
});
console.log(JSON.stringify(pts,null,1));
// click at p2
await page.mouse.click(409,475);
await page.waitForTimeout(1200);
console.log('after p2 click', JSON.stringify(await page.evaluate(()=>({again:window.__TRAIN_AGAIN_CLICK||0, launches:window.__TRAIN_LAUNCH||0, state:window.__G.game.state}))));
await browser.close();
