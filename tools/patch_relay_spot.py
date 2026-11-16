
import io
p='src/campaign.js'
s=io.open(p,encoding='utf-8').read()
old='''    Object.keys(RELAY_STATIONS).forEach(function (key) {
      var def = RELAY_STATIONS[key];
      var y = 0.03;
      try { y = G.physics.groundHeight(def.x, def.z, 2.5); } catch (e) { y = 0.03; }
      var g = G.props.build("relay_node");
      g.position.set(def.x, y, def.z);
      G.level.root.add(g);
      g.updateMatrixWorld(true);
      var boxes = [];
      var cols = (g.userData && g.userData.colliders) || [];
      for (var i = 0; i < cols.length; i++) {
        var c = cols[i];
        boxes.push(G.physics.addBox(
          [c.min[0] + def.x, c.min[1] + y, c.min[2] + def.z],
          [c.max[0] + def.x, c.max[1] + y, c.max[2] + def.z],
          { surface: c.surface || "metal", bulletOnly: !!c.bulletOnly }
        ));
      }
      relayPool[key] = { object: g, pos: new T.Vector3(def.x, y, def.z), boxes: boxes };
    });'''
new='''    Object.keys(RELAY_STATIONS).forEach(function (key) {
      var def = RELAY_STATIONS[key];
      var px = def.x, pz = def.z;
      try {
        var spot = nearestWalkable(px, pz, 2.2);
        if (spot && spot.d > 0) { px = spot.x; pz = spot.z; }
      } catch (e) {}
      var y = 0.03;
      try { y = G.physics.groundHeight(px, pz, 2.5); } catch (e) { y = 0.03; }
      var g = G.props.build("relay_node");
      g.position.set(px, y, pz);
      G.level.root.add(g);
      g.updateMatrixWorld(true);
      var boxes = [];
      var cols = (g.userData && g.userData.colliders) || [];
      for (var i = 0; i < cols.length; i++) {
        var c = cols[i];
        boxes.push(G.physics.addBox(
          [c.min[0] + px, c.min[1] + y, c.min[2] + pz],
          [c.max[0] + px, c.max[1] + y, c.max[2] + pz],
          { surface: c.surface || "metal", bulletOnly: !!c.bulletOnly }
        ));
      }
      relayPool[key] = { object: g, pos: new T.Vector3(px, y, pz), boxes: boxes };
    });'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('relay relocation patched')
