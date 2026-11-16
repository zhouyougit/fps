
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page=await browser.newPage({ viewport:{width:640,height:360} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(500);
console.log(JSON.stringify(await page.evaluate(()=>{
  const G=window.__G;
  return {keys:Object.keys(G).filter(k=>/back|level/i.test(k)), levelBack:!!G.level.backdrop, gBack:!!G.backdrop, backKeys:G.backdrop?Object.keys(G.backdrop):null, backRoot:G.backdrop&&G.backdrop.root&&G.backdrop.root.visible};
}),null,1));
await browser.close();
