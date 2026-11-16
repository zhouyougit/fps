
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:640,height:360} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(500);
console.log(JSON.stringify(await page.evaluate(()=>{
  const T=window.__G.THREE;
  const keys=Object.keys(T);
  return {hasBGU:!!T.BufferGeometryUtils, bguKeys:T.BufferGeometryUtils?Object.keys(T.BufferGeometryUtils):null, merge:typeof T.mergeGeometries, mergeBuf:typeof T.mergeBufferGeometries, total:keys.length, sample:keys.filter(k=>/merge|Buffer|Geometry/i.test(k)).slice(0,30)};
})));
await browser.close();
