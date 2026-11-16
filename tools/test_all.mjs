
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const urls = [
  ['v5','http://127.0.0.1:3311/versions/%E5%87%A0%E7%8C%AB_V5.html'],
  ['v4','http://127.0.0.1:3311/versions/%E5%87%A0%E7%8C%AB_V4.html'],
  ['v3','http://127.0.0.1:3311/versions/%E5%87%A0%E7%8C%AB_V3.html'],
  ['v2','http://127.0.0.1:3311/versions/%E5%87%A0%E7%8C%AB_V2.html'],
];
for (const [name,url] of urls) {
  const page = await browser.newPage({ viewport:{width:800,height:450} });
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto(url+'?q=low&noaudio=1&autostart=1',{waitUntil:'load',timeout:180000});
  let ok=true;
  try { await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:120000}); } catch(e){ ok=false; }
  const st = await page.evaluate(()=>({
    ready:window.__ready, fatal:window.__fatal, state:(window.__G&&window.__G.game&&window.__G.game.state),
    weapons:window.__G&&window.__G.weapon&&window.__G.weapon.list?window.__G.weapon.list.length:0,
    err:(window.__errors||[]).slice(0,3)
  })).catch(e=>({evalErr:String(e)}));
  console.log(name, ok, JSON.stringify(st), errs.slice(0,2));
  await page.close();
}
await browser.close();
