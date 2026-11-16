
import io
p='src/mp.js'
s=io.open(p,encoding='utf-8').read()
old='''      if (!r) {
        var grp = new T.Group();
        var col = colorFor(p.id);
        var body = new T.Mesh(new T.CapsuleGeometry(0.3, 1.05, 4, 8), new T.MeshStandardMaterial({ color: col, roughness: 0.62, metalness: 0.25 }));
        body.position.y = 0.9; body.castShadow = true; grp.add(body);
        var head = new T.Mesh(new T.SphereGeometry(0.18, 10, 8), new T.MeshStandardMaterial({ color: 0xd9b89a, roughness: 0.8 }));
        head.position.y = 1.62; head.castShadow = true; grp.add(head);
        var gun = new T.Mesh(new T.BoxGeometry(0.1, 0.12, 0.62), new T.MeshStandardMaterial({ color: 0x1b1e20, roughness: 0.5, metalness: 0.7 }));
        gun.position.set(0.16, 1.25, -0.4); grp.add(gun);
        var tag = makeTag(p.name || "几猫"); tag.position.y = 2.0; grp.add(tag);
        grp.position.set(p.x || 0, p.y || 0, p.z || 0);
        G.scene.add(grp);
        r = { grp: grp, hist: [], name: p.name || "几猫" };
        remotes.set(p.id, r);
      }'''
new='''      if (!r) {
        var grp = new T.Group();
        var col = colorFor(p.id);
        var suit = new T.MeshStandardMaterial({ color: col, roughness: 0.72, metalness: 0.12 });
        var dark = new T.MeshStandardMaterial({ color: 0x1d2226, roughness: 0.55, metalness: 0.45 });
        var skin = new T.MeshStandardMaterial({ color: 0xd6b79a, roughness: 0.85 });
        var torso = new T.Mesh(new T.BoxGeometry(0.56, 0.72, 0.32), suit); torso.position.y = 1.18; torso.castShadow = true; grp.add(torso);
        var chest = new T.Mesh(new T.BoxGeometry(0.48, 0.24, 0.34), dark); chest.position.y = 1.36; grp.add(chest);
        var pelvis = new T.Mesh(new T.BoxGeometry(0.44, 0.24, 0.3), dark); pelvis.position.y = 0.8; grp.add(pelvis);
        var legs = [];
        for (var li = 0; li < 2; li++) {
          var leg = new T.Mesh(new T.BoxGeometry(0.17, 0.72, 0.22), suit);
          leg.position.set(li ? -0.14 : 0.14, 0.44, 0); leg.castShadow = true; grp.add(leg); legs.push(leg);
        }
        var arms = [];
        for (var ai = 0; ai < 2; ai++) {
          var arm = new T.Mesh(new T.BoxGeometry(0.14, 0.58, 0.18), suit);
          arm.position.set(ai ? -0.37 : 0.37, 1.22, 0); arm.rotation.z = ai ? 0.08 : -0.08; arm.castShadow = true; grp.add(arm); arms.push(arm);
        }
        var head = new T.Mesh(new T.SphereGeometry(0.17, 12, 10), skin); head.position.y = 1.7; head.castShadow = true; grp.add(head);
        var helmet = new T.Mesh(new T.SphereGeometry(0.19, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58), dark);
        helmet.position.y = 1.73; grp.add(helmet);
        var visor = new T.Mesh(new T.BoxGeometry(0.24, 0.07, 0.03), new T.MeshStandardMaterial({ color: 0x8fe3ff, emissive: 0x2c8fb0, emissiveIntensity: 1.4, roughness: 0.2 }));
        visor.position.set(0, 1.7, -0.16); grp.add(visor);
        var rifle = new T.Mesh(new T.BoxGeometry(0.08, 0.11, 0.72), dark); rifle.position.set(0.22, 1.22, -0.34); grp.add(rifle);
        var tag = makeTag(p.name || "几猫"); tag.position.y = 2.08; grp.add(tag);
        grp.position.set(p.x || 0, p.y || 0, p.z || 0);
        G.scene.add(grp);
        r = { grp: grp, hist: [], name: p.name || "几猫", legs: legs, arms: arms };
        remotes.set(p.id, r);
      }'''
assert s.count(old)==1
s=s.replace(old,new,1)
# walking swing
old2='''        r.grp.rotation.y = a.yaw + dy * k;
      });'''
new2='''        r.grp.rotation.y = a.yaw + dy * k;
        var sp = Math.hypot(b.x - a.x, b.z - a.z) / Math.max(0.001, (b.t - a.t) / 1000);
        var walk = Math.min(1, sp / 4.5);
        var ph = performance.now() * 0.012;
        if (r.legs) { r.legs[0].rotation.x = Math.sin(ph) * 0.55 * walk; r.legs[1].rotation.x = -Math.sin(ph) * 0.55 * walk; }
        if (r.arms) { r.arms[0].rotation.x = -Math.sin(ph) * 0.4 * walk; r.arms[1].rotation.x = Math.sin(ph) * 0.4 * walk; }
      });'''
assert s.count(old2)==1
s=s.replace(old2,new2,1)
io.open(p,'w',encoding='utf-8').write(s)
print('avatar upgraded')
