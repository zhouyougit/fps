
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:900,height:500} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(800);
console.log(JSON.stringify(await page.evaluate(()=>{
  const G=window.__G;
  return {namesType:typeof G.props.names, names:G.props.names&&Array.from(G.props.names).slice(0,100), has:typeof G.props.has, build:typeof G.props.build};
})));
await browser.close();
