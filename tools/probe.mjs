
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{width:800,height:450} });
await page.goto('http://127.0.0.1:3311/game.html?shot=1&autostart=1&q=low&noaudio=1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
const info = await page.evaluate(()=>{
  const G=window.__G, root=G.weapon.root;
  const out={children:[], mats:[], weapon:{name:G.weapon.name,magSize:G.weapon.magSize,ammo:G.weapon.ammo,reserve:G.weapon.reserve,damage:G.weapon.damage,rpm:G.weapon.rpm,state:G.weapon.state}};
  root.traverse(o=>{ if(o!==root) out.children.push({name:o.name, type:o.type, tris:o.geometry?Math.round((o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3):0, layers:o.layers.mask, pos:o.position.toArray().map(v=>+v.toFixed(3))}); });
  out.mats = (G.mats.list? Object.keys(G.mats.list):[]) ;
  out.matsApi = Object.keys(G.mats);
  out.rootPos = root.position.toArray(); out.rootRot=[root.rotation.x,root.rotation.y,root.rotation.z];
  out.player = Object.keys(G.player); out.game=Object.keys(G.game); out.hud=Object.keys(G.hud); out.enemies=Object.keys(G.enemies); out.fx=Object.keys(G.fx); out.audio=Object.keys(G.audio);
  return out;
});
console.log(JSON.stringify(info).slice(0,20000));
await browser.close();
