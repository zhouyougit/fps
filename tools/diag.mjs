
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:1024,height:576} });
await page.goto('http://127.0.0.1:3311/game.html?shot=1&autostart=1&q=low&noaudio=1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
await page.waitForTimeout(1200);
await page.evaluate(()=>{ window.__SX.god(); window.__G.weapon.select(1); window.__G.player.yaw=Math.PI; });
await page.waitForTimeout(4000);
const info = await page.evaluate(()=>{
  const w=window.__G.weapon.list[1], root=w.root;
  const names=[];
  root.children.forEach((c,i)=>names.push({i,type:c.type,tris:c.geometry?Math.round((c.geometry.index?c.geometry.index.count:c.geometry.attributes.position.count)/3):0,visible:c.visible}));
  return {names, scale: root.scale.toArray(), pos: root.position.toArray(), rot:[root.rotation.x,root.rotation.y,root.rotation.z]};
});
console.log(JSON.stringify(info));
// hide poly
await page.evaluate(()=>{ window.__G.weapon.list[1].root.children[2].visible=false; });
await page.waitForTimeout(600); await page.screenshot({path:'tools/diag_nopoly.png',timeout:120000});
await page.evaluate(()=>{ const r=window.__G.weapon.list[1].root; r.children[2].visible=true; r.children[0].visible=false; });
await page.waitForTimeout(600); await page.screenshot({path:'tools/diag_noano.png',timeout:120000});
await browser.close();
