
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:960,height:540} });
page.on('pageerror',e=>console.log('ERR',e.message));
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=medium&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.evaluate(()=>{ window.__SX.applyMission(4); window.__G.game.start({skipIntro:true}); });
await page.waitForTimeout(1500);
const info = await page.evaluate(()=>{
  const G=window.__G;
  G.game.pause();
  document.getElementById('ui').style.display='none';
  G.camera.position.set(0, 8, 14);
  G.camera.lookAt(0,0,0);
  G.camera.updateMatrixWorld(true);
  G.render.frame(0.016);
  return {state:G.game.state, info: G.render.renderer.info.render, cam:G.camera.position.toArray(), map:window.__SX.mapId()};
});
console.log(JSON.stringify(info));
await page.waitForTimeout(1200);
await page.evaluate(()=>{ const G=window.__G; G.camera.position.set(0,8,14); G.camera.lookAt(0,0,0); G.render.frame(0.016); });
await page.screenshot({path:'tools/mapwork/test_freecam.png'});
await browser.close();
