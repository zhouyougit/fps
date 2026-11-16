
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:640,height:360} });
await page.goto('http://127.0.0.1:3311/game.html?shot=1&autostart=1&q=low&noaudio=1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
const info = await page.evaluate(()=>{
  const G=window.__G;
  const p=G.props.build('relay_node');
  const ud=p.userData;
  return {
    hasColliders: !!(ud.colliders&&ud.colliders.length),
    colliders: ud.colliders && ud.colliders.slice(0,3),
    udKeys: Object.keys(ud),
    physicsKeys: Object.keys(G.physics),
    boxCount: G.physics.boxes.length,
    relayPositions: G.level.objectives.map(o=>({id:o.id,pos:o.pos.toArray(),objPos:o.object.position.toArray()}))
  };
});
console.log(JSON.stringify(info,null,1).slice(0,4000));
await browser.close();
