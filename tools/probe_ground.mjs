
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page=await browser.newPage({ viewport:{width:800,height:450} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(500);
console.log(JSON.stringify(await page.evaluate(()=>{
  const G=window.__G, root=G.ground.root;
  return {children:root.children.map(o=>({type:o.type,name:o.name,visible:o.visible,mat:o.material&&o.material.name})), keys:Object.keys(G.ground), apron:!!G.ground.apron, sea:!!G.ground.sea};
}),null,1).slice(0,5000));
await browser.close();
