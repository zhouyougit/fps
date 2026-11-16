
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
console.log(JSON.stringify(await page.evaluate(()=>{
  const view=document.getElementById('view'), ui=document.getElementById('ui');
  const res=document.querySelector('.x-train-result');
  const panel=document.querySelector('.x-tr-panel');
  const r=panel.getBoundingClientRect();
  const els=document.elementsFromPoint(r.x+10,r.y+10).slice(0,6).map(e=>e.tagName+'.'+e.className);
  return {
    ui:{z:getComputedStyle(ui).zIndex, pe:getComputedStyle(ui).pointerEvents, pos:getComputedStyle(ui).position, opacity:getComputedStyle(ui).opacity},
    view:{z:getComputedStyle(view).zIndex, pe:getComputedStyle(view).pointerEvents},
    res:{z:getComputedStyle(res).zIndex, pe:getComputedStyle(res).pointerEvents, display:getComputedStyle(res).display, opacity:getComputedStyle(res).opacity},
    panelAt:[r.x,r.y], els,
    chain: (()=>{let a=res, out=[]; while(a&&a!==document.body){out.push(a.tagName+'.'+a.className+':z='+getComputedStyle(a).zIndex+',op='+getComputedStyle(a).opacity+',pe='+getComputedStyle(a).pointerEvents); a=a.parentElement;} return out;})()
  };
}), null, 1));
await browser.close();
