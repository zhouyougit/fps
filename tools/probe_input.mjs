
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:640,height:360} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(600);
console.log(JSON.stringify(await page.evaluate(()=>{
  const G=window.__G, I=G.input;
  return {keys:Object.keys(I), move:I.move, look:I.look, mouse:I.mouse, down:typeof I.down, pressed:typeof I.pressed, gameplay:I.gameplay, player:{yaw:+G.player.yaw.toFixed(2),pitch:+G.player.pitch.toFixed(2),pos:G.player.pos.toArray().map(v=>+v.toFixed(1))}, mats:!!G.mats};
}),null,1));
await browser.close();
