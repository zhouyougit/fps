
import io,re
p='src/mp.js'
s=io.open(p,encoding='utf-8').read()
start=s.index('    function makeTag(name) {')
end=s.index('    function removeRemote(id) {')
new='''    function makeTagV2(name, team) {
      var c = document.createElement("canvas");
      c.width = 320; c.height = 96;
      var g = c.getContext("2d");
      var tex = new T.CanvasTexture(c);
      tex.colorSpace = T.SRGBColorSpace;
      var sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
      sp.scale.set(2.1, 0.63, 1);
      function draw(hp, alive) {
        g.clearRect(0, 0, 320, 96);
        g.fillStyle = "rgba(4,6,8,.62)";
        g.fillRect(0, 0, 320, 96);
        g.fillStyle = team === 1 ? "#ff6a55" : "#4fa8ff";
        g.fillRect(0, 0, 6, 96);
        g.font = "600 30px sans-serif"; g.textAlign = "left"; g.textBaseline = "middle";
        g.fillStyle = alive === false ? "rgba(232,228,218,.45)" : "#e8e4da";
        g.fillText(name, 18, 34);
        var pct = Math.max(0, Math.min(1, (hp == null ? 100 : hp) / 100));
        g.fillStyle = "rgba(255,255,255,.14)"; g.fillRect(18, 60, 284, 10);
        g.fillStyle = pct > 0.5 ? "#9cff6a" : pct > 0.25 ? "#ffd166" : "#ff5a5a";
        g.fillRect(18, 60, 284 * pct, 10);
        tex.needsUpdate = true;
      }
      draw(100, true);
      return { sprite: sp, draw: draw };
    }

    function buildRemoteModel(p) {
      var teamCol = new T.Color(p.team === 1 ? 0xff6a55 : 0x4fa8ff);
      var suit = new T.MeshStandardMaterial({ color: teamCol, roughness: 0.62, metalness: 0.18 });
      var suitDark = new T.MeshStandardMaterial({ color: 0x222a30, roughness: 0.55, metalness: 0.4 });
      var plate = new T.MeshStandardMaterial({ color: 0x39434a, roughness: 0.42, metalness: 0.62 });
      var accent = new T.MeshStandardMaterial({ color: 0x0d1113, emissive: teamCol, emissiveIntensity: 1.8, roughness: 0.3, metalness: 0.5 });
      var skin = new T.MeshStandardMaterial({ color: 0xd6b79a, roughness: 0.85 });
      var visor = new T.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x2c8fb0, emissiveIntensity: 1.8, roughness: 0.18, metalness: 0.8 });
      var grp = new T.Group();
      grp.name = "mp-player";
      var hips = new T.Group(); hips.position.y = 0.92; grp.add(hips);
      var torso = new T.Mesh(new T.BoxGeometry(0.58, 0.62, 0.32), suit); torso.position.y = 0.32; torso.castShadow = true; hips.add(torso);
      var chest = new T.Mesh(new T.BoxGeometry(0.64, 0.3, 0.36), plate); chest.position.y = 0.48; hips.add(chest);
      var rig = new T.Mesh(new T.BoxGeometry(0.46, 0.2, 0.4), suitDark); rig.position.set(0, 0.3, 0.02); hips.add(rig);
      var back = new T.Mesh(new T.BoxGeometry(0.42, 0.46, 0.2), suitDark); back.position.set(0, 0.34, 0.25); hips.add(back);
      var chevron = new T.Mesh(new T.BoxGeometry(0.16, 0.05, 0.02), accent); chevron.position.set(0.18, 0.52, 0.19); hips.add(chevron);
      for (var si = 0; si < 2; si++) {
        var shoulder = new T.Mesh(new T.BoxGeometry(0.2, 0.16, 0.3), plate);
        shoulder.position.set(si ? -0.38 : 0.38, 0.58, 0); hips.add(shoulder);
      }
      var head = new T.Group(); head.position.y = 0.82; hips.add(head);
      var neck = new T.Mesh(new T.CylinderGeometry(0.08, 0.09, 0.1, 8), skin); neck.position.y = -0.02; head.add(neck);
      var face = new T.Mesh(new T.SphereGeometry(0.17, 16, 12), skin); face.position.y = 0.14; face.castShadow = true; head.add(face);
      var helmet = new T.Mesh(new T.SphereGeometry(0.2, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), plate); helmet.position.y = 0.18; head.add(helmet);
      var brim = new T.Mesh(new T.BoxGeometry(0.34, 0.04, 0.12), suitDark); brim.position.set(0, 0.17, -0.16); head.add(brim);
      var visorM = new T.Mesh(new T.BoxGeometry(0.27, 0.07, 0.03), visor); visorM.position.set(0, 0.12, -0.17); head.add(visorM);
      var mask = new T.Mesh(new T.BoxGeometry(0.16, 0.1, 0.1), suitDark); mask.position.set(0, 0.02, -0.14); head.add(mask);
      var tag = makeTagV2(p.name || "几猫", p.team);
      tag.sprite.position.y = 1.92; grp.add(tag.sprite);

      var legs = [], arms = [];
      for (var li = 0; li < 2; li++) {
        var legPivot = new T.Group();
        legPivot.position.set(li ? -0.15 : 0.15, 0.92, 0);
        var thigh = new T.Mesh(new T.BoxGeometry(0.19, 0.4, 0.22), suit); thigh.position.y = -0.2; thigh.castShadow = true; legPivot.add(thigh);
        var knee = new T.Group(); knee.position.y = -0.4; legPivot.add(knee);
        var shin = new T.Mesh(new T.BoxGeometry(0.16, 0.38, 0.18), suitDark); shin.position.y = -0.19; knee.add(shin);
        var boot = new T.Mesh(new T.BoxGeometry(0.2, 0.14, 0.3), plate); boot.position.set(0, -0.42, -0.04); knee.add(boot);
        grp.add(legPivot); legs.push(legPivot);
      }
      for (var ai = 0; ai < 2; ai++) {
        var armPivot = new T.Group();
        armPivot.position.set(ai ? -0.4 : 0.4, 1.46, 0);
        var upper = new T.Mesh(new T.BoxGeometry(0.14, 0.34, 0.18), suit); upper.position.y = -0.17; upper.castShadow = true; armPivot.add(upper);
        var elbow = new T.Group(); elbow.position.y = -0.34; armPivot.add(elbow);
        var fore = new T.Mesh(new T.BoxGeometry(0.12, 0.3, 0.16), suitDark); fore.position.y = -0.15; elbow.add(fore);
        var glove = new T.Mesh(new T.BoxGeometry(0.12, 0.1, 0.16), plate); glove.position.y = -0.32; elbow.add(glove);
        grp.add(armPivot); arms.push(armPivot);
      }
      var rifle = new T.Mesh(new T.BoxGeometry(0.09, 0.12, 0.78), suitDark);
      rifle.position.set(0.3, 1.32, -0.3); rifle.rotation.x = -0.06; grp.add(rifle);
      var mag = new T.Mesh(new T.BoxGeometry(0.07, 0.18, 0.14), plate); mag.position.set(0.3, 1.18, -0.22); grp.add(mag);
      var sight = new T.Mesh(new T.BoxGeometry(0.06, 0.08, 0.16), accent); sight.position.set(0.3, 1.43, -0.35); grp.add(sight);
      return { grp: grp, hips: hips, torso: torso, head: head, legL: legs[0], legR: legs[1], armL: arms[0], armR: arms[1], tag: tag.sprite, tagDraw: tag.draw, lastHp: -1 };
    }

    function upsertRemote(p) {
      var r = remotes.get(p.id);
      if (!r) {
        r = buildRemoteModel(p);
        r.hist = []; r.name = p.name || "几猫"; r.phase = 0; r.dead = false;
        G.scene.add(r.grp);
        remotes.set(p.id, r);
      }
      r.grp.visible = true;
      if (r.lastHp !== p.hp || r.dead !== (p.alive === false)) {
        r.lastHp = p.hp;
        r.dead = p.alive === false;
        r.tagDraw(p.hp, p.alive !== false);
        r.tag.visible = p.alive !== false;
      }
      r.hist.push({ t: performance.now(), x: p.x, y: p.y, z: p.z, yaw: p.yaw || 0, pitch: p.pitch || 0, crouch: !!p.crouch });
      if (r.hist.length > 24) r.hist.shift();
    }

'''
s=s[:start]+new+s[end:]
io.open(p,'w',encoding='utf-8').write(s)
print('remote 2.0 model replaced')
