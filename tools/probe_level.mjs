
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:640,height:360} });
await page.goto('http://127.0.0.1:3311/game.html?shot=1&autostart=1&q=low&noaudio=1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
const info = await page.evaluate(()=>{
  const G=window.__G, L=G.level, j=v=>JSON.parse(JSON.stringify(v));
  const out={};
  out.keys=Object.keys(L);
  out.playerStart={pos:L.playerStart.pos.toArray(), yaw:L.playerStart.yaw};
  out.objectives=(L.objectives||[]).map(o=>({id:o.id,label:o.label,short:o.short,pos:o.pos.toArray()}));
  out.extraction=L.extraction&&{pos:L.extraction.pos.toArray(),radius:L.extraction.radius};
  out.zones=j(L.zones||[]);
  out.spawns=(L.enemySpawns||[]).map(s=>({p:[+s.pos.x.toFixed(1),+s.pos.y.toFixed(1),+s.pos.z.toFixed(1)],t:s.type,z:s.zone}));
  out.covers=(L.coverPoints||[]).slice(0,90).map(v=>[+v.x.toFixed(1),+v.y.toFixed(1),+v.z.toFixed(1)]);
  out.interiorBoxes=(L.interiorBoxes||[]).map(b=>({min:j(b.min),max:j(b.max)}));
  out.cinematic=j(L.cinematicPath||[]);
  out.counts={spawns:(L.enemySpawns||[]).length,covers:(L.coverPoints||[]).length};
  return out;
});
console.log(JSON.stringify(info).slice(0,16000));
await browser.close();
