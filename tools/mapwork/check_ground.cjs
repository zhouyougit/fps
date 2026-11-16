
const path=require('path');
const sim=require(path.resolve(__dirname,'../../server/sim.js'));
const m=require(path.resolve(__dirname,'../../server/maps.json'));
const w=m.maps.harbor;
const world=sim.createWorld(w.boxes,{bounds:w.bounds,groundY:w.groundY,seaY:w.seaY,quayX:w.quayX});
for(const [x,z] of [[-10,-9],[0,-9],[-5,-9]]) console.log(x,z,'gh',world.groundHeight(x,z,20));
// list boxes containing points at head height
for(const [x,z] of [[-10,-9],[0,-9],[-5,-9]]) {
 const hits=world.boxes.filter(b=>x>=b.min.x-0.4&&x<=b.max.x+0.4&&z>=b.min.z-0.4&&z<=b.max.z+0.4&&b.max.y>0.1);
 console.log('near',x,z,hits.map(b=>({min:b.min,max:b.max,tag:b.tag,surface:b.surface})));
}
