
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page=await browser.newPage({ viewport:{width:800,height:450} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(500);
console.log(JSON.stringify(await page.evaluate(()=>{
  const o=document.querySelector('.h-obj');
  return {html:o&&o.innerHTML.slice(0,600), kids:o&&[...o.children].map(c=>({cls:c.className,txt:c.textContent.slice(0,40)}))};
}),null,1));
await browser.close();
