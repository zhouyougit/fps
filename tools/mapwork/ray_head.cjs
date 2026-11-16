
const path=require('path');
const sim=require(path.resolve(__dirname,'../../server/sim.js'));
const m=require(path.resolve(__dirname,'../../server/maps.json'));
const w=m.maps.harbor;
const world=sim.createWorld(w.boxes,{bounds:w.bounds,groundY:w.groundY,seaY:w.seaY,quayX:w.quayX});
function ray(oy,ty){const a={x:-10,y:oy,z:-9},b={x:0,y:ty,z:-9};const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,len=Math.hypot(dx,dy,dz);const h=world.raycast(a,{x:dx/len,y:dy/len,z:dz/len},len-0.05);return h;}
for(const [name,oy,ty] of [['body',1.62,0.85],['head',1.62,1.68]]){const h=ray(oy,ty);console.log(name,h?{dist:h.dist,point:h.point,surface:h.surface,box:h.box&&{min:h.box.min,max:h.box.max,tag:h.box.tag}}:null);}
