
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
  G.level.root.visible=false; if(G.level.backdrop)G.level.backdrop.visible=false;
  if(G.ground&&G.ground.root)G.ground.root.visible=false; if(G.render.sky)G.render.sky.visible=false;
  G.render.sun.intensity=0.35;
  const raw=new T.Group(); raw.name='depot_raw'; G.scene.add(raw);
  const mats={};
  const mat=(name,color,rough,metal)=> new T.MeshStandardMaterial({color,roughness:rough,metalness:metal||0});
  const floorM=mat('floor',0x5b5f60,0.95,0.05), wallM=mat('wall',0x3f4649,0.9,0.1), ceilM=mat('ceil',0x2f3437,0.95,0.05);
  function box(x,y,z,w,h,d,m){ const b=new T.Mesh(new T.BoxGeometry(w,h,d),m); b.position.set(x,y,z); b.receiveShadow=true; raw.add(b); return b; }
  box(0,-0.2,0,52,0.4,34,floorM);
  box(0,3.5,-17,52,7,0.6,wallM); box(0,3.5,17,52,7,0.6,wallM);
  box(-26,3.5,0,0.6,7,34,wallM); box(26,3.5,0,0.6,7,34,wallM);
  box(0,7.2,0,52,0.3,34,ceilM);
  for(let x=-24;x<=24;x+=6) box(x,6.9,0,0.25,0.4,34,mat('beam',0x24292c,0.8,0.4));
  // shelf rows
  const shelfSpots=[];
  for(const z of [-10,-4,2,8]) for(const x of [-18,-12,-6,0,6,12,18]) shelfSpots.push([x,z]);
  // lights
  for(const [x,z] of [[-15,-8],[0,-4],[15,-8],[-8,8],[8,8],[0,0]]){
    const l=new T.PointLight(0xffd2a0, 22, 22, 2); l.position.set(x,5.2,z); raw.add(l);
    const lamp=new T.Mesh(new T.BoxGeometry(1.2,0.12,0.35), new T.MeshStandardMaterial({color:0xffe0b0,emissive:0xffc880,emissiveIntensity:5})); lamp.position.set(x,6.4,z); raw.add(lamp);
  }
  // red emergency
  const red=new T.PointLight(0xff3a28, 8, 16, 2); red.position.set(-24,4.5,-16); raw.add(red);
  return {setup:true};
});
await page.waitForTimeout(300);
// build props and merge in second evaluate (needs functions)
const res2 = await page.evaluate(()=>{
  const G=window.__G,T=G.THREE,P=G.physics;
  const raw=G.scene.getObjectByName('depot_raw');
  function mergeStatic(root){
    root.updateMatrixWorld(true);
    const groups=new Map();
    root.traverse(o=>{
      if(!o.isMesh||o.isSkinnedMesh) return;
      const mats=Array.isArray(o.material)?o.material:[o.material];
      const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
      geo.applyMatrix4(o.matrixWorld);
      const pos=geo.attributes.position, nor=geo.attributes.normal, uv=geo.attributes.uv;
      if(!pos) return;
      for(const m of mats){
        if(!m) continue;
        let g=groups.get(m); if(!g){ g={pos:[],nor:[],uv:[]}; groups.set(m,g); }
        for(let i=0;i<pos.count;i++){ g.pos.push(pos.getX(i),pos.getY(i),pos.getZ(i)); if(nor)g.nor.push(nor.getX(i),nor.getY(i),nor.getZ(i)); if(uv)g.uv.push(uv.getX(i),uv.getY(i)); }
      }
    });
    const out=new T.Group(); out.name='depot_merged';
    for(const [m,g] of groups){
      const geo=new T.BufferGeometry();
      geo.setAttribute('position',new T.Float32BufferAttribute(g.pos,3));
      if(g.nor.length) geo.setAttribute('normal',new T.Float32BufferAttribute(g.nor,3));
      if(g.uv.length) geo.setAttribute('uv',new T.Float32BufferAttribute(g.uv,2));
      const mesh=new T.Mesh(geo,m); mesh.castShadow=true; mesh.receiveShadow=true; out.add(mesh);
    }
    return out;
  }
  const props=[];
  for(let i=0;i<28;i++){
    const n=['shelf_rack','crate_stack','crate_wood','pallet_stack','barrel','ibc_tote','dumpster','forklift','pallet','toolbox_cart'][i%10];
    const x=-20+(i%7)*6.3, z=-12+Math.floor(i/7)*7.5;
    props.push([n,x,z,(i%4)*0.4]);
  }
  const t0=performance.now();
  for(const [n,x,z,yaw] of props){
    const o=G.props.build(n); o.position.set(x,0,z); o.rotation.y=yaw; raw.add(o); o.updateMatrixWorld(true);
    const cols=(o.userData&&o.userData.colliders)||[];
    for(const c of cols) P.addBox([c.min[0]+x,c.min[1],c.min[2]+z],[c.max[0]+x,c.max[1],c.max[2]+z],{surface:c.surface||'metal'});
  }
  const merged=mergeStatic(raw);
  G.scene.remove(raw); G.scene.add(merged);
  // physics floor/walls
  P.boxes.length=0;
  P.addBox([-26,0,-17],[26,0.2,17],{surface:'concrete'});
  P.addBox([-26,0,-17.6],[26,7,-16.6],{surface:'metal'});
  P.addBox([-26,0,16.6],[26,7,17.6],{surface:'metal'});
  P.addBox([-26.6,0,-17],[-25.6,7,17],{surface:'metal'});
  P.addBox([25.6,0,-17],[26.6,7,17],{surface:'metal'});
  P.build();
  // cover points
  G.level.coverPoints=props.map(([n,x,z])=>new T.Vector3(x,0,z+1.2));
  G.level.playerStart={pos:new T.Vector3(0,0.2,14),yaw:0};
  G.game.start({skipIntro:true});
  G.render.scene.fog=new T.FogExp2(0x0a0d10,0.028);
  const t1=performance.now();
  return {ms:+(t1-t0).toFixed(1), meshes:merged.children.length, calls:G.render.stats().calls, tris:G.render.stats().tris, walk:P.nav.isWalkable(0,14)};
});
await page.waitForTimeout(2500);
await page.screenshot({path:'tools/depot_test.png',timeout:120000});
console.log(JSON.stringify({res,res2,e:errs.slice(0,3)}));
await browser.close();
