
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1000,height:560} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(1200);
await page.evaluate(()=>{ window.__G.player.damage(999,null); });
for(let i=0;i<12;i++){ await page.waitForTimeout(1500); const vis=await page.evaluate(()=>getComputedStyle(document.querySelector('.m-screen[data-s="dead"]')).display!=='none'); if(vis) break; }
console.log(JSON.stringify(await page.evaluate(()=>{
  const b=document.querySelector('[data-act="retry"]'), r=b.getBoundingClientRect();
  const at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
  const scr=b.closest('.m-screen');
  const chain=[]; let n=b; while(n&&n!==document.body){ const cs=getComputedStyle(n); chain.push({tag:n.tagName,cls:(n.className||'').toString().slice(0,40),pe:cs.pointerEvents,z:cs.zIndex,pos:cs.position}); n=n.parentElement; }
  return {at:at&&at.outerHTML.slice(0,140), chain};
}),null,1));
await browser.close();
