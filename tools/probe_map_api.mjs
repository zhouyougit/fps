
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:800,height:450} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(800);
console.log(JSON.stringify(await page.evaluate(()=>{
  const G=window.__G, P=G.physics, S=G.scene;
  const props = G.props && (G.props.list || Object.keys(G.props));
  return {
    levelRoot:{children:G.level.root.children.length, visible:G.level.root.visible, pos:G.level.root.position.toArray()},
    boxes:P.boxes.length, nav:!!P.nav, playerStart:G.level.playerStart,
    ground:!!G.ground, groundKeys:G.ground?Object.keys(G.ground):null,
    sceneChildren:S.children.length,
    lights:S.children.filter(o=>o.isLight).map(o=>({type:o.type,int:o.intensity,pos:o.position.toArray().map(v=>+v.toFixed(1))})),
    propKeys: props?props.slice(0,80):null,
    backdrop:S.children.filter(o=>o.name||o.type).slice(0,20).map(o=>o.name||o.type),
    objectives:G.level.objectives.map(o=>o.id),
    fog:!!S.fog
  };
}),null,1).slice(0,7000));
await browser.close();
