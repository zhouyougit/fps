
import io
p='src/game.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

# heavy lunge damage
rep('''                (D.damage(Gt.lungeDamage, m.pos),''','''                (D.damage(m.lungeDamage || Gt.lungeDamage, m.pos),''')

# shield flash decay in hound update (right after think block end / before wantYaw)
rep('''        (m.wantYaw = m.yaw),
        (m.maxSpeed = 0),
        (m.cool -= T),
        (m.lungeCd -= T);''','''        (m.wantYaw = m.yaw),
        (m.maxSpeed = 0),
        (m.cool -= T),
        (m.lungeCd -= T);
      if (m.shieldMesh && m.shieldFlash > 0) {
        m.shieldFlash = Math.max(0, m.shieldFlash - T);
        if (m.shieldMesh.material)
          m.shieldMesh.material.emissiveIntensity = 0.6 + m.shieldFlash * 14;
      }''')

# wave director: marksman / heavy
rep('''      for (let oe = 0; oe < (V.elite || 0); oe++)
        Y.splice(Math.min(Y.length, 1 + oe * 2), 0, "elite");
      for (let oe = 0; oe < V.hound; oe++)
        Y.splice(Math.min(Y.length, 1 + oe * 2), 0, "hound");''','''      for (let oe = 0; oe < (V.elite || 0); oe++)
        Y.splice(Math.min(Y.length, 1 + oe * 2), 0, "elite");
      for (let oe = 0; oe < (V.marksman || 0); oe++)
        Y.splice(Math.min(Y.length, 2 + oe * 3), 0, "marksman");
      for (let oe = 0; oe < (V.heavy || 0); oe++)
        Y.splice(Math.min(Y.length, 1 + oe * 4), 0, "heavy");
      for (let oe = 0; oe < V.hound; oe++)
        Y.splice(Math.min(Y.length, 1 + oe * 2), 0, "hound");''')

# HUD names
rep('''          drone: "自爆无人机", elite: "精英猎犬", boss: "港区主控", target: "训练靶机",''','''          drone: "自爆无人机", elite: "精英猎犬", boss: "港区主控",
          marksman: "狙击猎犬", heavy: "重装盾卫", target: "训练靶机",''')
io.open(p,'w',encoding='utf-8').write(s)
print('wave + hud + heavy details patched')

p2='src/campaign.js'
s2=io.open(p2,encoding='utf-8').read()
old='''      waves: [{ gull: 3, hound: 1 }, { gull: 3, hound: 2 }, { gull: 4, hound: 3 }],'''
new='''      waves: [{ gull: 3, hound: 1 }, { gull: 3, hound: 2 }, { gull: 4, hound: 3, marksman: 1 }],'''
assert s2.count(old)==1
s2=s2.replace(old,new,1)
old2='''      waves: [{ gull: 2, hound: 2, drone: 1 }, { gull: 3, hound: 3, drone: 1 }, { gull: 3, hound: 4, drone: 2, elite: 1 }],'''
new2='''      waves: [{ gull: 2, hound: 2, drone: 1 }, { gull: 3, hound: 3, drone: 1, marksman: 1 }, { gull: 3, hound: 4, drone: 2, elite: 1, marksman: 1, heavy: 1 }],'''
assert s2.count(old2)==1
s2=s2.replace(old2,new2,1)
old3='''      waves: [{ gull: 3, hound: 2, drone: 2 }, { gull: 4, hound: 3, drone: 2, elite: 1 }, { gull: 4, hound: 3, drone: 3, elite: 2 }],'''
new3='''      waves: [{ gull: 3, hound: 2, drone: 2 }, { gull: 4, hound: 3, drone: 2, elite: 1, marksman: 1 }, { gull: 4, hound: 3, drone: 3, elite: 2, marksman: 2, heavy: 2 }],'''
assert s2.count(old3)==1
s2=s2.replace(old3,new3,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('mission waves updated')

p3='src/ext.js'
s3=io.open(p3,encoding='utf-8').read()
old4='''    try { initAudioPolish(); } catch (e) { console.error("[ext] audio init", e); }'''
new4='''    try { initAudioPolish(); } catch (e) { console.error("[ext] audio init", e); }
    initEnemyFeedback();'''
assert s3.count(old4)==1
s3=s3.replace(old4,new4,1)
old5='''  /* ------------------------------------------------- V9 audio polish */'''
new5='''  /* ------------------------------------------------- V10 enemy feedback */
  var shieldFxT = 0;
  function initEnemyFeedback() {
    G.events.on("sx:shield-hit", function (ev) {
      var now = performance.now();
      if (now - shieldFxT < 90) return;
      shieldFxT = now;
      try { G.fx.sparks(ev.point, new G.THREE.Vector3(0, 0, 1), 4); } catch (e) {}
      try { G.audio.play("impact_metal", { pos: ev.point, gain: 0.5, pitch: 1.5 }); } catch (e) {}
    });
    G.events.on("sx:shield-break", function (ev) {
      var e = ev && ev.enemy;
      if (e && e.pos) {
        try { G.fx.sparks(e.pos, new G.THREE.Vector3(0, 1, 0), 14); } catch (err) {}
        try { G.audio.play("impact_metal", { pos: e.pos, gain: 1, pitch: 0.7 }); } catch (err) {}
      }
      G.hud.feed("<b>重装盾卫</b> 护盾破碎");
    });
  }

  /* ------------------------------------------------- V9 audio polish */'''
assert s3.count(old5)==1
s3=s3.replace(old5,new5,1)
io.open(p3,'w',encoding='utf-8').write(s3)
print('ext enemy feedback added')
