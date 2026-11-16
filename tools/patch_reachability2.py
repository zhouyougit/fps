
import io
p='src/campaign.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

rep('''      var y = 0;
      try { y = G.physics.groundHeight(def.x, def.z, 10); } catch (e) { y = 0; }''','''      var y = 0.03;
      try { y = G.physics.groundHeight(def.x, def.z, 2.5); } catch (e) { y = 0.03; }''')

rep('''  function applyMission(idx) {''','''  function nearestWalkable(x, z, maxR) {
    var nav = G.physics && G.physics.nav;
    if (!nav) return null;
    if (nav.isWalkable(x, z)) return { x: x, z: z, d: 0 };
    for (var r = 0.5; r <= maxR; r += 0.5) {
      for (var a = 0; a < 16; a++) {
        var th = (a / 16) * Math.PI * 2;
        var nx = x + Math.cos(th) * r, nz = z + Math.sin(th) * r;
        if (nav.isWalkable(nx, nz)) return { x: nx, z: nz, d: r };
      }
    }
    return null;
  }

  function validateObjectives() {
    var out = [];
    if (!G || !G.physics || !G.level) return out;
    var start = G.level.playerStart && G.level.playerStart.pos;
    var list = (G.level.objectives || []).slice();
    if (G.level.extraction) list.push({ id: "extract", label: "撤离点", pos: G.level.extraction.pos });
    list.forEach(function (o) {
      var near = nearestWalkable(o.pos.x, o.pos.z, 2.2);
      var floor = G.physics.groundHeight(o.pos.x, o.pos.z, 2.5);
      var path = near && start ? G.physics.nav.findPath(start, new G.THREE.Vector3(near.x, floor, near.z)) : null;
      out.push({
        id: o.id,
        label: o.label,
        pos: [o.pos.x, o.pos.y, o.pos.z].map(function (v) { return +v.toFixed(2); }),
        floor: +floor.toFixed(2),
        near: near ? [near.x, near.z].map(function (v) { return +v.toFixed(2); }) : null,
        nearDist: near ? +near.d.toFixed(2) : null,
        path: path ? path.length : 0,
        ok: !!near && !!path && Math.abs(o.pos.y - floor) < 2.2
      });
    });
    return out;
  }

  function applyMission(idx) {''')

rep('''    var dh = document.querySelector(".m-debrief .m-h");
    if (dh) dh.textContent = m.done || "行动完成";
  }''','''    var dh = document.querySelector(".m-debrief .m-h");
    if (dh) dh.textContent = m.done || "行动完成";
    try {
      var vr = validateObjectives();
      var bad = vr.filter(function (x) { return !x.ok; });
      if (bad.length && window.console && console.warn)
        console.warn("[ext] unreachable objectives", bad);
    } catch (e) {}
  }''')
io.open(p,'w',encoding='utf-8').write(s)
print('campaign reachability patched')

p2='src/ext.js'
s2=io.open(p2,encoding='utf-8').read()
old='''      applyMission: function (i) { applyMission(i); },'''
new='''      applyMission: function (i) { applyMission(i); },
      validateObjectives: function () { return validateObjectives(); },'''
assert s2.count(old)==1
s2=s2.replace(old,new,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('ext validator exposure patched')
