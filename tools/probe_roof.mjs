
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:800,height:450} });
await page.goto('http://127.0.0.1:3311/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
await page.waitForTimeout(1000);
console.log(JSON.stringify(await page.evaluate(()=>{
  const G=window.__G, P=G.physics, L=G.level;
  const spots=[[13.5,2.59,12.4],[13.5,0,12.4],[4.4,2.59,12.4],[-2.2,0,12.4],[20,2.6,5],[25,2.6,10],[30,0,0],[35,0,0]];
  const out=spots.map(([x,y,z])=>({x,y,z, walk:P.nav.isWalkable(x,z), ground:+P.groundHeight(x,z,12).toFixed(2)}));
  return {vantage:L.vantage, spots:out, cover:L.coverPoints.length, interior:L.interiorBoxes};
}), null, 1).slice(0,4000));
await browser.close();
