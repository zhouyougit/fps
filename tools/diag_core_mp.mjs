
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const p=await browser.newPage({ viewport:{width:900,height:500} });
await p.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await p.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await p.waitForTimeout(600);
await p.evaluate(()=>window.__MP.join('ws://172.16.17.189:9100','A','dbg-'+Date.now(),'core'));
await new Promise(r=>setTimeout(r,4000));
console.log(JSON.stringify(await p.evaluate(()=>{
  const G=window.__G;
  return {
    map:window.__SX.mapId(), info:window.__SX.mapInfo('core'),
    fog:G.scene.fog?{c:G.scene.fog.color.getHexString(),d:G.scene.fog.density}:null,
    sun:G.render.sun.intensity,
    lights:G.scene.children.filter(o=>o.isLight).map(l=>({t:l.type,i:l.intensity,vis:l.visible})),
    pos:G.player.pos.toArray().map(v=>+v.toFixed(1)), yaw:+G.player.yaw.toFixed(2),
    mapGroups:G.scene.children.filter(o=>o.type==='Group').map(g=>({n:g.name,k:g.children.length,vis:g.visible}))
  };
}),null,1).slice(0,5000));
await browser.close();
