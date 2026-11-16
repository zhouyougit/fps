
import io
p='src/mp.js'
s=io.open(p,encoding='utf-8').read()
old='''        var sp = Math.hypot(b.x - a.x, b.z - a.z) / Math.max(0.001, (b.t - a.t) / 1000);
        var walk = Math.min(1, sp / 4.5);
        var ph = performance.now() * 0.012;
        if (r.legs) { r.legs[0].rotation.x = Math.sin(ph) * 0.55 * walk; r.legs[1].rotation.x = -Math.sin(ph) * 0.55 * walk; }
        if (r.arms) { r.arms[0].rotation.x = -Math.sin(ph) * 0.4 * walk; r.arms[1].rotation.x = Math.sin(ph) * 0.4 * walk; }'''
new='''        var sp = Math.hypot(b.x - a.x, b.z - a.z) / Math.max(0.001, (b.t - a.t) / 1000);
        var walk = Math.min(1, sp / 4.2);
        r.phase += dt * (1.6 + sp * 2.1);
        var swing = Math.sin(r.phase) * (0.18 + walk * 0.55);
        r.legL.rotation.x = swing;
        r.legR.rotation.x = -swing;
        r.armL.rotation.x = -swing * 0.7;
        r.armR.rotation.x = swing * 0.45 - 0.35;
        r.head.rotation.x = Math.max(-0.5, Math.min(0.5, (b.pitch || 0) * 0.6));
        r.torso.position.y = 0.32 + Math.abs(Math.sin(r.phase)) * 0.02 * walk;
        r.hips.position.y = b.crouch ? 0.72 : 0.92;
        r.grp.scale.y = b.crouch ? 0.88 : 1;
        if (r.dead) {
          r.grp.rotation.z += (1.38 - r.grp.rotation.z) * Math.min(1, dt * 7);
          r.tag.visible = false;
        } else {
          r.grp.rotation.z += (0 - r.grp.rotation.z) * Math.min(1, dt * 10);
        }'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('remote animation updated')
