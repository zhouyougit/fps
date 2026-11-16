
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:640,height:360} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(500);
console.log(JSON.stringify(await page.evaluate(()=>{
  const G=window.__G;
  let mats=null;
  try{ mats=G.mats.get('concrete_dirty'); }catch(e){ mats='ERR:'+e.message; }
  return {
    matsType:typeof G.mats, get:typeof (G.mats&&G.mats.get), matName:mats&&mats.name, matColor:mats&&mats.color&&mats.color.getHexString(), matMap:!!(mats&&mats.map),
    renderKeys:Object.keys(G.render||{}), info:!!(G.render&&G.render.renderer&&G.render.renderer.info)
  };
}),null,1));
await browser.close();
