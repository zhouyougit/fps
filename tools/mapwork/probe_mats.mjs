
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:320,height:180} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1',{waitUntil:'load',timeout:240000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:300000});
const r = await page.evaluate(()=>{
  const G=window.__G; const m=G.mats;
  const out={keys:Object.keys(m), hasGet:typeof m.get, getSteel:!!(m.get&&m.get('steel_beam')), getGalv:!!(m.get&&m.get('steel_galv')), getConcrete:!!(m.get&&m.get('concrete'))};
  try{ out.size = m.get('steel_galv') && m.get('steel_galv').uuid; }catch(e){}
  return out;
});
console.log(JSON.stringify(r,null,1));
await browser.close();
