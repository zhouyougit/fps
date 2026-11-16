
import io
p='src/game.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:70])
    s=s.replace(old,new,1)

# target hover behavior
rep('''    function x(y) {
      let b = s.player,
        m = i.t;
      if (d.variant === "drone") {''','''    function x(y) {
      let b = s.player,
        m = i.t;
      if (d.trainTarget) {
        if (!d.alive) return;
        let ph = d.trainPhase || 0;
        let tx = d.home.x + Math.sin(m * 0.42 + ph) * 2.2;
        let tz = d.home.z + Math.cos(m * 0.36 + ph * 1.3) * 2.2;
        let ty = d.alt + Math.sin(m * 1.15 + ph) * 0.35;
        let k = Math.min(1, y * 2.4);
        d.pos.x += (tx - d.pos.x) * k;
        d.pos.y += (ty - d.pos.y) * k;
        d.pos.z += (tz - d.pos.z) * k;
        d.vel.set(0, 0, 0);
        if (b && b.alive) d.yaw = Math.atan2(b.pos.x - d.pos.x, b.pos.z - d.pos.z);
        d.pitch = Math.sin(m * 0.9 + ph) * 0.06;
        d.roll = Math.sin(m * 1.3 + ph) * 0.08;
        a.group.rotation.set(d.pitch, d.yaw, d.roll);
        for (let r = 0; r < 4; r++)
          l["rotor" + r].rotation.y += (r % 3 === 0 ? 1 : -1) * 34 * y;
        if (d.lens && d.lens.color) {
          let pulse = 0.55 + 0.45 * Math.sin(m * 4 + ph);
          d.lens.color.setRGB(0.25, 1.15 * pulse, 1.45 * pulse);
        }
        return;
      }
      if (d.variant === "drone") {''')

# target death: pop, no explosion damage
rep('''    function g(y) {
      (d.dieT += y),''','''    function g(y) {
      if (d.trainTarget) {
        d.dieT += y;
        try {
          s.fx.explosion(d.pos, 0.55);
          s.fx.sparks(d.pos, Hf, 8);
          s.fx.smoke(d.pos, { size: 0.32, life: 0.6, rise: 0.4 });
        } catch (e) {}
        i.retire(d);
        return;
      }
      (d.dieT += y),''')
io.open(p,'w',encoding='utf-8').write(s)
print('gull training behavior patched')
