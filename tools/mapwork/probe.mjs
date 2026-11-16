
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:640,height:360} });
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(500);
const info = await page.evaluate(()=>{
  const G=window.__G;
  const keys=(o)=>Object.keys(o||{}).slice(0,60);
  return {
    gameKeys: keys(G.game), playerKeys: keys(G.player), renderKeys: keys(G.render),
    pause: typeof G.game.pause, state: G.game.state,
    uiChildren: [...document.querySelectorAll('#ui > *')].map(e=>e.className||e.id).slice(0,40),
    canvas: {w:document.querySelector('#view').width,h:document.querySelector('#view').height},
    playerStart: G.player.pos.toArray(),
    playerUpdate: typeof G.player.update,
    cam: G.camera.position.toArray()
  };
});
console.log(JSON.stringify(info,null,1));
await browser.close();
