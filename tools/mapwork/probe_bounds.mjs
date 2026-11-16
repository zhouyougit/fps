
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:480,height:270} });
page.on('pageerror',e=>console.log('ERR',e.message));
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:240000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:300000});
const out = [];
for (const [idx,id] of [[0,'harbor'],[3,'depot'],[4,'ship'],[null,'core']]) {
  const r = await page.evaluate(({idx,id})=>{
    const G=window.__G;
    if(idx==null){ window.__SX.switchMap('core'); G.game.start({skipIntro:true}); } else { window.__SX.applyMission(idx); G.game.start({skipIntro:true}); }
    return { map:window.__SX.mapId(), bounds:{min:G.physics.bounds.min.toArray(),max:G.physics.bounds.max.toArray()}, boxes:G.physics.boxes.length };
  },{idx,id});
  out.push(r);
}
console.log(JSON.stringify(out,null,1));
await browser.close();
