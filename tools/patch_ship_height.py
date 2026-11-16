
import io
p='src/mapkit.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)
rep('''        backdropVisible: L.backdrop ? L.backdrop.visible : true,''','''        backdropVisible: G.backdrop ? G.backdrop.root.visible : true,''')
rep('''      harbor.root.visible = false;
      if (G.level.backdrop) G.level.backdrop.visible = false;''','''      harbor.root.visible = false;
      if (G.backdrop) G.backdrop.root.visible = false;''')
rep('''      harbor.root.visible = harbor.rootVisible;
      if (G.level.backdrop) G.level.backdrop.visible = harbor.backdropVisible;''','''      harbor.root.visible = harbor.rootVisible;
      if (G.backdrop) G.backdrop.root.visible = harbor.backdropVisible;''')
# relay y
rep('''        relay: function (id, x, z, label) {
          var o = G.props.build("relay_node");
          o.position.set(x, 0.03, z);''','''        relay: function (id, x, z, label, y) {
          var yy = y == null ? 0.03 : y;
          var o = G.props.build("relay_node");
          o.position.set(x, yy, z);''')
rep('''            boxes.push({ min: [c.min[0] + x, c.min[1] + 0.03, c.min[2] + z], max: [c.max[0] + x, c.max[1] + 0.03, c.max[2] + z], opts: { surface: c.surface || "metal" } });
          }
          relays[id] = { id: id, label: label || id, object: o, pos: vec(x, 0.03, z) };''','''            boxes.push({ min: [c.min[0] + x, c.min[1] + yy, c.min[2] + z], max: [c.max[0] + x, c.max[1] + yy, c.max[2] + z], opts: { surface: c.surface || "metal" } });
          }
          relays[id] = { id: id, label: label || id, object: o, pos: vec(x, yy, z) };''')
io.open(p,'w',encoding='utf-8').write(s)
print('mapkit backdrop/relay patched')

p2='src/map_ship.js'
s2=io.open(p2,encoding='utf-8').read()
s2=s2.replace('K.box(0, -0.15, 0, 54, 0.5, 20, deck, { surface: "metal" });','K.box(0, 0.05, 0, 54, 0.5, 20, deck, { surface: "metal" });',1)
s2=s2.replace('K.relay("ship_r1", -18, -6.2, "系泊绞车中继");','K.relay("ship_r1", -18, -6.2, "系泊绞车中继", 0.32);',1)
s2=s2.replace('K.relay("ship_r2", 0, 3.2, "货舱门中继");','K.relay("ship_r2", 0, 3.2, "货舱门中继", 0.32);',1)
s2=s2.replace('K.relay("ship_r3", 18, -6.2, "驾驶台中继");','K.relay("ship_r3", 18, -6.2, "驾驶台中继", 0.32);',1)
s2=s2.replace('extraction: { pos: new T.Vector3(0, 0.32, -8.4), radius: 2.4 },','extraction: { pos: new T.Vector3(0, 0.32, -8.4), radius: 2.4 },',1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('ship height patched')
