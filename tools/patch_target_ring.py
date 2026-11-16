
import io
p='src/training.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:70])
    s=s.replace(old,new,1)

# ring helper before spawnTrainingTarget
rep('''  function spawnTrainingTarget() {''','''  function ensureTargetRing(e) {
    if (e.__trainRing) return e.__trainRing;
    var T = G.THREE;
    var g = new T.Group();
    var mat = new T.MeshBasicMaterial({ color: 0x6fe3ff, transparent: true, opacity: 0.85, depthWrite: false, side: T.DoubleSide });
    var ring = new T.Mesh(new T.TorusGeometry(0.72, 0.028, 6, 28), mat);
    var ring2 = new T.Mesh(new T.TorusGeometry(0.5, 0.016, 6, 24), mat.clone());
    ring2.material.opacity = 0.5;
    var dot = new T.Mesh(new T.SphereGeometry(0.06, 8, 8), new T.MeshBasicMaterial({ color: 0xff5a40 }));
    g.add(ring, ring2, dot);
    e.rig.group.add(g);
    e.__trainRing = g;
    return g;
  }

  function spawnTrainingTarget() {''')

# set phase/lens/ring
rep('''    e.trainTarget = true;
    e.variant = "target";
    e.hp = 1;''','''    e.trainTarget = true;
    e.variant = "target";
    e.trainPhase = Math.random() * 6.283;
    if (e.lens && e.lens.color) e.lens.color.setRGB(0.3, 1.5, 1.9);
    var ring = ensureTargetRing(e);
    ring.visible = true;
    e.hp = 1;''')

# animate rings in updateTraining (after target spawn logic)
rep('''    if (trainHud) {
      var tSec = Math.ceil(tr.t * 10) / 10;''','''    var tlist = G.enemies.list;
    for (var ti = 0; ti < tlist.length; ti++) {
      var te = tlist[ti];
      if (te.alive && te.trainTarget && te.__trainRing) {
        te.__trainRing.rotation.z += dt * 0.9;
        var pulse = 1 + Math.sin(G.time.t * 3 + (te.trainPhase || 0)) * 0.05;
        te.__trainRing.scale.setScalar(pulse);
      }
    }
    if (trainHud) {
      var tSec = Math.ceil(tr.t * 10) / 10;''')

# hide stale rings on spawn
rep('''    G.events.on("enemy:killed", function (ev) {
      var tr = S.training;''','''    G.events.on("enemy:spawn", function (ev) {
      var e = ev && ev.enemy;
      if (e && e.__trainRing && !e.trainTarget) e.__trainRing.visible = false;
    });
    G.events.on("enemy:killed", function (ev) {
      var tr = S.training;''')
io.open(p,'w',encoding='utf-8').write(s)
print('training target visuals patched')
