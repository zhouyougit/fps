
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:320,height:180} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1',{waitUntil:'load',timeout:240000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:300000});
const r = await page.evaluate(()=>{
  const m=window.__G.mats;
  const names=m.names();
  const a=m.get('steel_beam'), b=m.get('steel_galv'), c=m.get('not_a_material_xyz');
  return { count:names.length, names:names.slice(0,80), steel_beam:a&&{uuid:a.uuid,color:a.color&&a.color.getHexString(),map:!!a.map}, galv:b&&{uuid:b.uuid,color:b.color&&b.color.getHexString()}, unknown:c&&{uuid:c.uuid,color:c.color&&c.color.getHexString()}, same:a===c };
});
console.log(JSON.stringify(r,null,1));
await browser.close();
