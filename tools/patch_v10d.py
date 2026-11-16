
import io
p='src/game.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

# pool size
rep('      poolHounds: 8,','      poolHounds: 12,')

# marksman range within sight
rep('''            j.rangeMin = 20; j.rangeMax = 46; j.burstCount = 1;''','''            j.rangeMin = 20; j.rangeMax = 44; j.burstCount = 1;''')

# turret spawn whitelist
rep('''          let G = T === "gull" || T === "drone" ? d : T === "hound" || T === "elite" || T === "boss" || T === "marksman" || T === "heavy" ? v : null;''','''          let G = T === "gull" || T === "drone" ? d : T === "hound" || T === "elite" || T === "boss" || T === "marksman" || T === "heavy" || T === "turret" ? v : null;''')
rep('''          if (!j && (T === "hound" || T === "elite" || T === "boss" || T === "marksman" || T === "heavy") && n.length) {''','''          if (!j && (T === "hound" || T === "elite" || T === "boss" || T === "marksman" || T === "heavy" || T === "turret") && n.length) {''')

# reset fixed + hit sizing
rep('''            (j.rangeMin = 0), (j.rangeMax = 0), (j.burstCount = 0), (j.shotDamage = 0),''','''            (j.fixed = !1),
            (j.rangeMin = 0), (j.rangeMax = 0), (j.burstCount = 0), (j.shotDamage = 0),''')
rep('''            (j.hitScale = T === "boss" ? 1.8 : T === "elite" ? 1.15 : T === "heavy" ? 1.28 : 1),''','''            (j.hitScale = T === "boss" ? 1.8 : T === "elite" ? 1.15 : T === "heavy" ? 1.28 : T === "turret" ? 1.15 : 1),''')
rep('''            (j.hitRadiusSq = T === "boss" ? 5.2 : T === "elite" ? 2.2 : T === "heavy" ? 3.4 : T === "marksman" ? 2.0 : 1.7);''','''            (j.hitRadiusSq = T === "boss" ? 5.2 : T === "elite" ? 2.2 : T === "heavy" ? 3.4 : T === "turret" ? 2.4 : T === "marksman" ? 2.0 : 1.7);''')
rep('''          if (j.rig && j.rig.group) j.rig.group.scale.setScalar(T === "boss" ? 1.8 : T === "elite" ? 1.15 : T === "heavy" ? 1.22 : 1);''','''          if (j.rig && j.rig.group) j.rig.group.scale.setScalar(T === "boss" ? 1.8 : T === "elite" ? 1.15 : T === "heavy" ? 1.22 : T === "turret" ? 1.12 : 1);''')

# turret config after heavy block
rep('''          } else if (T === "boss") {
            j.hp = 1600; j.maxHp = 1600;''','''          } else if (T === "turret") {
            j.hp = 420; j.maxHp = 420;
            j.rangeMin = 6; j.rangeMax = 30; j.burstCount = 5;
            j.shotDamage = 8; j.telegraph = 0.6; j.coolMul = 1.0;
            j.spreadMul = 0.45; j.runSpeed = 0; j.fixed = !0;
            if (j.lens && j.lens.color) j.lens.color.setRGB(7.5, 1.6, 0.3);
          } else if (T === "boss") {
            j.hp = 1600; j.maxHp = 1600;''')

# hide legs for turret, restore otherwise
rep('''          if (j.shieldMesh) {
            j.shieldMesh.visible = T === "heavy";
            if (T === "heavy" && j.shieldMesh.material) j.shieldMesh.material.opacity = 0.8;
          }''','''          if (j.shieldMesh) {
            j.shieldMesh.visible = T === "heavy";
            if (T === "heavy" && j.shieldMesh.material) j.shieldMesh.material.opacity = 0.8;
          }
          if (j.rig && j.rig.bones) {
            let legNames = ["abdFL","thighFL","shinFL","abdFR","thighFR","shinFR","abdRL","thighRL","shinRL","abdRR","thighRR","shinRR"];
            for (let li = 0; li < legNames.length; li++)
              if (j.rig.bones[legNames[li]])
                j.rig.bones[legNames[li]].scale.setScalar(T === "turret" ? 0.01 : 1);
          }''')

# freeze goal setting
rep('''    function _(T, D) {
      (!D && m.hasGoal && m.goal.distanceToSquared(T) < 0.25) ||
        (m.goal.copy(T), (m.hasGoal = !0), (m.planT = 0), (m.stuckT = 0));
    }''','''    function _(T, D) {
      if (m.fixed) {
        (m.hasGoal = !1), (m.maxSpeed = 0), (m.path = null);
        return;
      }
      (!D && m.hasGoal && m.goal.distanceToSquared(T) < 0.25) ||
        (m.goal.copy(T), (m.hasGoal = !0), (m.planT = 0), (m.stuckT = 0));
    }''')

# laser: time accumulator instead of dt check
rep('''              (m.elite || m.laser) &&
                m.los &&
                D &&
                D.alive &&
                !m.boss &&
                T > 0.05 &&
                (() => {
                  try {
                    s.fx.tracer(m.muzzle, D.eye, {
                      color: 16724736,
                      speed: 3200,
                      width: 0.005,
                      trail: false,
                      intensity: 7,
                    });
                  } catch (e) {}
                })(),''','''              (m.elite || m.laser) &&
                m.los &&
                D &&
                D.alive &&
                !m.boss &&
                (() => {
                  m.laserT = (m.laserT || 0) - T;
                  if (m.laserT > 0) return;
                  m.laserT = 0.055;
                  try {
                    s.fx.tracer(m.muzzle, D.eye, {
                      color: 16724736,
                      speed: 3200,
                      width: 0.005,
                      trail: false,
                      intensity: 7,
                    });
                  } catch (e) {}
                })(),''')

# shield covers weak too (less reduction)
rep('''          if (m.shieldHp > 0 && G !== "weak" && C) {
            let sfx = Math.sin(m.yaw), sfz = Math.cos(m.yaw);
            if (C.x * sfx + C.z * sfz < -0.25) {
              dmg *= 0.15;
              m.shieldHp -= T * 0.9;''','''          if (m.shieldHp > 0 && C) {
            let sfx = Math.sin(m.yaw), sfz = Math.cos(m.yaw);
            if (C.x * sfx + C.z * sfz < -0.25) {
              dmg *= G === "weak" ? 0.35 : 0.15;
              m.shieldHp -= T * (G === "weak" ? 0.7 : 0.9);''')

# hud name
rep('''          marksman: "狙击猎犬", heavy: "重装盾卫", target: "训练靶机",''','''          marksman: "狙击猎犬", heavy: "重装盾卫", turret: "固定炮台", target: "训练靶机",''')

# wave director turret
rep('''      for (let oe = 0; oe < (V.heavy || 0); oe++)
        Y.splice(Math.min(Y.length, 1 + oe * 4), 0, "heavy");''','''      for (let oe = 0; oe < (V.heavy || 0); oe++)
        Y.splice(Math.min(Y.length, 1 + oe * 4), 0, "heavy");
      for (let oe = 0; oe < (V.turret || 0); oe++)
        Y.splice(Math.min(Y.length, 2 + oe * 4), 0, "turret");''')

# audio pitch by variant
rep('''        ze(he === "hound" ? "hound_fire" : "gull_fire", {
          pos: pe,
          gain: 1,
          jitter: 0.04,
        }),''','''        let vv = te.enemy && te.enemy.variant;
        let vpitch = vv === "marksman" ? 1.25 : vv === "heavy" ? 0.68 : vv === "turret" ? 0.82 : 1;
        let vgain = vv === "turret" ? 1.15 : 1;
        ze(he === "hound" ? "hound_fire" : "gull_fire", {
          pos: pe,
          gain: vgain,
          jitter: 0.04,
          pitch: vpitch,
        }),''')
io.open(p,'w',encoding='utf-8').write(s)
print('turret + fixes patched')

p2='src/campaign.js'
s2=io.open(p2,encoding='utf-8').read()
s2=s2.replace('''      waves: [{ gull: 3, hound: 1 }, { gull: 3, hound: 2 }, { gull: 4, hound: 3, marksman: 1 }],''','''      waves: [{ gull: 3, hound: 1 }, { gull: 3, hound: 2 }, { gull: 4, hound: 3, marksman: 1, turret: 1 }],''',1)
s2=s2.replace('''      waves: [{ gull: 2, hound: 2, drone: 1 }, { gull: 3, hound: 3, drone: 1, marksman: 1 }, { gull: 3, hound: 4, drone: 2, elite: 1, marksman: 1, heavy: 1 }],''','''      waves: [{ gull: 2, hound: 2, drone: 1 }, { gull: 3, hound: 3, drone: 1, marksman: 1, turret: 1 }, { gull: 3, hound: 4, drone: 2, elite: 1, marksman: 1, heavy: 1 }],''',1)
s2=s2.replace('''      waves: [{ gull: 3, hound: 2, drone: 2 }, { gull: 4, hound: 3, drone: 2, elite: 1, marksman: 1 }, { gull: 4, hound: 3, drone: 3, elite: 2, marksman: 2, heavy: 2 }],''','''      waves: [{ gull: 3, hound: 2, drone: 2 }, { gull: 4, hound: 3, drone: 2, elite: 1, marksman: 1, turret: 1 }, { gull: 4, hound: 3, drone: 3, elite: 2, marksman: 2, heavy: 2, turret: 1 }],''',1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('turret waves added')
