
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:900,height:500} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(800);
console.log(JSON.stringify(await page.evaluate(()=>{
  const G=window.__G,T=G.THREE;
  const names=G.props.names();
  const dims={};
  for(const n of names.slice(0,40)){
    try{ const o=G.props.build(n); const b=new T.Box3().setFromObject(o); const s=b.getSize(new T.Vector3()); dims[n]=[+s.x.toFixed(2),+s.y.toFixed(2),+s.z.toFixed(2)]; }
    catch(e){ dims[n]='ERR'; }
  }
  return {names, dims};
}),null,1).slice(0,9000));
await browser.close();
