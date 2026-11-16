
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1000,height:560} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.evaluate(()=>window.__G.game.start({skipIntro:true}));
await page.waitForTimeout(800);
await page.evaluate(()=>window.__G.player.damage(999,null));
for(let i=0;i<15;i++){ await page.waitForTimeout(1500); const vis=await page.evaluate(()=>getComputedStyle(document.querySelector('.m-screen[data-s="dead"]')).display!=='none'); if(vis) break; }
console.log(JSON.stringify(await page.evaluate(()=>{
  const b=document.querySelector('[data-act="retry"]'), r=b.getBoundingClientRect();
  const at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
  const ui=document.getElementById('ui');
  return {text:b.textContent, at:at&&at.outerHTML.slice(0,140), uiPE:getComputedStyle(ui).pointerEvents, menuPE:getComputedStyle(b.closest('.menu')).pointerEvents, z:getComputedStyle(b.closest('.menu')).zIndex, canvasZ:getComputedStyle(document.getElementById('view')).zIndex};
}),null,1));
await page.evaluate(()=>document.querySelector('[data-act="retry"]').click());
await page.waitForTimeout(300);
console.log('dom1', JSON.stringify(await page.evaluate(()=>({text:document.querySelector('[data-act="retry"]').textContent, state:window.__G.game.state}))));
await page.evaluate(()=>document.querySelector('[data-act="retry"]').click());
await page.waitForTimeout(1200);
console.log('dom2', JSON.stringify(await page.evaluate(()=>({state:window.__G.game.state}))));
await browser.close();
