
import io
p='src/game.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

# --- spawn dispatch types ---
rep('''          let G = T === "gull" || T === "drone" ? d : T === "hound" || T === "elite" || T === "boss" ? v : null;''','''          let G = T === "gull" || T === "drone" ? d : T === "hound" || T === "elite" || T === "boss" || T === "marksman" || T === "heavy" ? v : null;''')
rep('''          if (!j && (T === "hound" || T === "elite" || T === "boss") && n.length) {''','''          if (!j && (T === "hound" || T === "elite" || T === "boss" || T === "marksman" || T === "heavy") && n.length) {''')

# --- variant config ---
rep('''          (j.variant = T === "gull" || T === "hound" ? "" : T),
            (j.elite = T === "elite" || T === "boss"),
            (j.boss = T === "boss"),
            (j.hitScale = T === "boss" ? 1.8 : T === "elite" ? 1.15 : 1),
            (j.hitRadiusSq = T === "boss" ? 5.2 : T === "elite" ? 2.2 : 1.7);
          if (j.rig && j.rig.group) j.rig.group.scale.setScalar(T === "boss" ? 1.8 : T === "elite" ? 1.15 : 1);
          if (T === "drone") {
            j.hp = 26; j.maxHp = 26;
            if (j.lens && j.lens.color) j.lens.color.setRGB(7, 0.45, 0.18);
          } else if (T === "elite") {
            j.hp = 230; j.maxHp = 230;
            if (j.lens && j.lens.color) j.lens.color.setRGB(6.5, 0.35, 0.2);
          } else if (T === "boss") {
            j.hp = 1600; j.maxHp = 1600;
            j.bossPhase = 0; j.bossT = 0; j.volleyCd = 6; j.stompCd = 4;
            if (j.lens && j.lens.color) j.lens.color.setRGB(8, 0.3, 0.12);
          }''','''          (j.variant = T === "gull" || T === "hound" ? "" : T),
            (j.elite = T === "elite" || T === "boss"),
            (j.boss = T === "boss"),
            (j.hitScale = T === "boss" ? 1.8 : T === "elite" ? 1.15 : T === "heavy" ? 1.28 : 1),
            (j.hitRadiusSq = T === "boss" ? 5.2 : T === "elite" ? 2.2 : T === "heavy" ? 3.4 : T === "marksman" ? 2.0 : 1.7);
          if (j.rig && j.rig.group) j.rig.group.scale.setScalar(T === "boss" ? 1.8 : T === "elite" ? 1.15 : T === "heavy" ? 1.22 : 1);
          // 重置变体专有状态（对象池复用）
          (j.rangeMin = 0), (j.rangeMax = 0), (j.burstCount = 0), (j.shotDamage = 0),
            (j.telegraph = 0), (j.laser = !1), (j.coolMul = 0), (j.spreadMul = 0),
            (j.runSpeed = 0), (j.shieldHp = 0), (j.maxShield = 0), (j.shieldFlash = 0);
          if (T === "drone") {
            j.hp = 26; j.maxHp = 26;
            if (j.lens && j.lens.color) j.lens.color.setRGB(7, 0.45, 0.18);
          } else if (T === "elite") {
            j.hp = 230; j.maxHp = 230;
            if (j.lens && j.lens.color) j.lens.color.setRGB(6.5, 0.35, 0.2);
          } else if (T === "marksman") {
            j.hp = 95; j.maxHp = 95;
            j.rangeMin = 20; j.rangeMax = 46; j.burstCount = 1;
            j.shotDamage = 27; j.telegraph = 1.15; j.laser = !0;
            j.coolMul = 1.35; j.spreadMul = 0.32; j.runSpeed = 3.3;
            if (j.lens && j.lens.color) j.lens.color.setRGB(7.5, 0.25, 0.15);
          } else if (T === "heavy") {
            j.hp = 320; j.maxHp = 320; j.shieldHp = 240; j.maxShield = 240;
            j.rangeMin = 5; j.rangeMax = 15; j.runSpeed = 2.4;
            j.lungeDamage = 24; j.coolMul = 0.85; j.shotDamage = 6;
            if (j.lens && j.lens.color) j.lens.color.setRGB(2.2, 3.2, 7.5);
          } else if (T === "boss") {
            j.hp = 1600; j.maxHp = 1600;
            j.bossPhase = 0; j.bossT = 0; j.volleyCd = 6; j.stompCd = 4;
            if (j.lens && j.lens.color) j.lens.color.setRGB(8, 0.3, 0.12);
          }
          // 重装盾卫：正面护盾网格
          if (T === "heavy" && j.rig && j.rig.group && !j.shieldMesh) {
            try {
              let sg = new Ys(0.62, 0.62, 1.1, 20, 1, -Math.PI * 0.4, Math.PI * 0.8);
              let sm = new Qt({ color: 0x2b3740, metalness: 0.85, roughness: 0.32, transparent: !0, opacity: 0.8, side: Sn, emissive: 0x0a1a22, emissiveIntensity: 0.6 });
              let mesh = new Qe(sg, sm);
              mesh.position.set(0, 0.8, 0.05);
              mesh.castShadow = !1; mesh.receiveShadow = !0;
              j.rig.group.add(mesh);
              j.shieldMesh = mesh;
            } catch (e) {}
          }
          if (j.shieldMesh) {
            j.shieldMesh.visible = T === "heavy";
            if (T === "heavy" && j.shieldMesh.material) j.shieldMesh.material.opacity = 0.8;
          }''')

# --- shield damage reduction ---
rep('''        damage(T, D, C, G) {
          if (!m.alive) return !1;
          if (
            ((m.hp -= T),
            s.events.emit("enemy:hit", {''','''        damage(T, D, C, G) {
          if (!m.alive) return !1;
          let dmg = T;
          if (m.shieldHp > 0 && G !== "weak" && C) {
            let sfx = Math.sin(m.yaw), sfz = Math.cos(m.yaw);
            if (C.x * sfx + C.z * sfz < -0.25) {
              dmg *= 0.15;
              m.shieldHp -= T * 0.9;
              m.shieldFlash = 0.12;
              try { s.events.emit("sx:shield-hit", { enemy: m, point: D }); } catch (e) {}
              if (m.shieldHp <= 0) {
                m.shieldHp = 0;
                if (m.shieldMesh) m.shieldMesh.visible = !1;
                try { s.events.emit("sx:shield-break", { enemy: m }); } catch (e) {}
              }
            }
          }
          if (
            ((m.hp -= dmg),
            s.events.emit("enemy:hit", {''')
io.open(p,'w',encoding='utf-8').write(s)
print('spawn + shield damage patched')
