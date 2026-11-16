
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(800);
const res = await page.evaluate(()=>{
  const G=window.__G,T=G.THREE,P=G.physics;
  const t0=performance.now();
  G.level.root.visible=false;
  if(G.level.backdrop) G.level.backdrop.visible=false;
  if(G.ground && G.ground.root) G.ground.root.visible=false;
  if(G.render.sky) G.render.sky.visible=false;
  G.render.sun.intensity=0.5;
  const root=new T.Group(); root.name='map_test'; G.scene.add(root);
  const mat=new T.MeshStandardMaterial({color:0x74787a, roughness:0.95, metalness:0.05});
  function box(x,y,z,w,h,d,m){ const b=new T.Mesh(new T.BoxGeometry(w,h,d),m||mat); b.position.set(x,y,z); b.receiveShadow=true; root.add(b); return b; }
  box(0,-0.2,0,60,0.4,40);
  box(0,3,-20,60,6,1); box(0,3,20,60,6,1); box(-30,3,0,1,6,40); box(30,3,0,1,6,40);
  box(0,6.1,0,60,0.2,40);
  P.boxes.length=0;
  P.addBox([-30,0,-20],[30,0.2,20],{surface:'concrete'});
  P.addBox([-30,0,-20.5],[30,6,-19.5],{surface:'metal'});
  P.addBox([-30,0,19.5],[30,6,20.5],{surface:'metal'});
  P.addBox([-30.5,0,-20],[-29.5,6,20],{surface:'metal'});
  P.addBox([29.5,0,-20],[30.5,6,20],{surface:'metal'});
  const props=[['shelf_rack',-10,0,-12,0],['shelf_rack',-10,0,-6,0],['forklift',4,0,-8,0.6],['crate_stack',12,0,-12,0.3],['container20',18,0,8,0.2],['pallet_stack',8,0,4,0.8],['barrel',15,0,-2,0],['floodlight_stand',2,0,12,0]];
  for(const [n,x,y,z,yaw] of props){
    const o=G.props.build(n); o.position.set(x,y,z); o.rotation.y=yaw; root.add(o); o.updateMatrixWorld(true);
    const cols=(o.userData&&o.userData.colliders)||[];
    for(const c of cols) P.addBox([c.min[0]+x,c.min[1]+y,c.min[2]+z],[c.max[0]+x,c.max[1]+y,c.max[2]+z],{surface:c.surface||'metal',bulletOnly:!!c.bulletOnly});
  }
  // lights
  for(const [x,z] of [[-8,-12],[10,-4],[0,10],[-18,4]]){
    const l=new T.PointLight(0xffd7a0, 18, 18, 2); l.position.set(x,4.4,z); root.add(l);
  }
  P.build();
  G.level.playerStart={pos:new T.Vector3(0,0.2,10),yaw:0};
  G.game.start({skipIntro:true});
  const t1=performance.now();
  return {walk:P.nav.isWalkable(0,10), ground:+P.groundHeight(0,10,5).toFixed(2), ms:+(t1-t0).toFixed(1), calls:G.render.stats?G.render.stats().calls:null, tris:G.render.stats?G.render.stats().tris:null, children:root.children.length};
});
await page.waitForTimeout(2500);
await page.screenshot({path:'tools/map_test.png',timeout:120000});
console.log(JSON.stringify(res), errs.slice(0,3));
await browser.close();
