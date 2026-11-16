
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:800,height:450} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(800);
console.log(JSON.stringify(await page.evaluate(()=>{
  const G=window.__G,L=G.level;
  return {
    enemySpawns:(L.enemySpawns||[]).slice(0,8).map(p=>({keys:Object.keys(p),pos:p.pos&&p.pos.toArray?p.pos.toArray():p.pos,type:p.type,kind:p.kind,air:p.air})),
    count:(L.enemySpawns||[]).length,
    cover:(L.coverPoints||[]).slice(0,4).map(p=>p.toArray?p.toArray():p)
  };
}),null,1).slice(0,6000));
await browser.close();
