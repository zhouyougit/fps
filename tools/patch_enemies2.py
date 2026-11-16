
import io
p='src/game.js'
s=io.open(p,encoding='utf-8').read()

def rep(old,new,count=1):
    global s
    assert s.count(old)==count, (s.count(old), old[:70])
    s=s.replace(old,new,count)

# 1) elite/boss tuning in telegraph
rep('''                    ((m.es = "tele"),
                    (m.esT = Gt.telegraph),
                    s.events.emit("enemy:telegraph", {
                      enemy: m,
                      type: "hound",
                      time: Gt.telegraph,
                      pos: m.pos,
                    }))''','''                    ((m.es = "tele"),
                    (m.esT = m.elite ? 1.0 : Gt.telegraph),
                    s.events.emit("enemy:telegraph", {
                      enemy: m,
                      type: "hound",
                      time: m.elite ? 1.0 : Gt.telegraph,
                      pos: m.pos,
                    }))''')

# 2) elite laser while aiming
rep('''          case "aim":
          case "cool": {
            (m.wantYaw = I),
              (m.esT += T),''','''          case "aim":
          case "cool": {
            (m.wantYaw = I),
              (m.esT += T),
              m.elite &&
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
                })(),''')

# 3) burst count
rep('((m.es = "burst"), (m.shots = Gt.burst), (m.esT = 0));','((m.es = "burst"), (m.shots = m.boss ? 3 : m.elite ? 1 : Gt.burst), (m.esT = 0));')

# 4) cooldown
rep('''                (m.cool =
                  Gt.cooldown[0] + o() * (Gt.cooldown[1] - Gt.cooldown[0])),''','''                (m.cool =
                  (Gt.cooldown[0] + o() * (Gt.cooldown[1] - Gt.cooldown[0])) *
                  (m.boss ? 0.68 : m.elite ? 1.25 : 1)),''')

# 5) damage & spread
rep('''        Q = s.combat.enemyShot(m.muzzle, Po, {
          damage: Gt.shotDamage,
          range: 200,
        })''','''        Q = s.combat.enemyShot(m.muzzle, Po, {
          damage: m.boss ? 13 : m.elite ? 26 : Gt.shotDamage,
          range: 200,
        })''')
rep('''        (Gt.spreadFar + (Gt.spreadNear - Gt.spreadFar) * m.exposure) *
        (1 + i.playerSpeed * 0.3);''','''        (Gt.spreadFar + (Gt.spreadNear - Gt.spreadFar) * m.exposure) *
        (1 + i.playerSpeed * 0.3) *
        (m.boss ? 0.8 : m.elite ? 0.45 : 1);''')

# 6) boss phases / volley / stomp after K
rep('''        K = D ? Math.hypot(D.pos.x - m.pos.x, D.pos.z - m.pos.z) : 1e9;
      if (m.mode === "patrol") {''','''        K = D ? Math.hypot(D.pos.x - m.pos.x, D.pos.z - m.pos.z) : 1e9;
      if (m.boss && m.alive) {
        m.bossT += T;
        let maxHp = m.maxHp || 1600;
        if (m.bossPhase === 0 && m.hp < maxHp * 0.66) {
          m.bossPhase = 1;
          i.events.emit("sx:boss-phase", { enemy: m, phase: 1 });
          try {
            for (let k = 0; k < 2; k++)
              s.enemies.spawn("drone", new W(m.pos.x + (k ? 3.4 : -3.4), m.pos.y + 4, m.pos.z + 2.2), { state: "alert" });
          } catch (e) {}
        }
        if (m.bossPhase === 1 && m.hp < maxHp * 0.33) {
          m.bossPhase = 2;
          i.events.emit("sx:boss-phase", { enemy: m, phase: 2 });
          try {
            for (let k = 0; k < 2; k++)
              s.enemies.spawn("drone", new W(m.pos.x + (k ? 4.5 : -4.5), m.pos.y + 4, m.pos.z - 2.2), { state: "alert" });
          } catch (e) {}
        }
        m.volleyCd -= T;
        if (m.volleyCd <= 0 && m.los && D && D.alive) {
          m.volleyCd = m.bossPhase >= 2 ? 4.6 : 6.4;
          let bx = D.pos.x - m.muzzle.x,
            by = D.pos.y + 1 - m.muzzle.y,
            bz = D.pos.z - m.muzzle.z,
            bl = Math.hypot(bx, by, bz) || 1;
          (bx /= bl), (by /= bl), (bz /= bl);
          for (let k = -1; k <= 1; k++) {
            let ang = k * 0.075,
              cx = Math.cos(ang),
              sx = Math.sin(ang),
              dx = bx * cx - bz * sx,
              dz = bx * sx + bz * cx,
              dir = new W(dx, by, dz);
            try {
              s.combat.enemyShot(m.muzzle, dir, { damage: 12, range: 200 });
              s.fx.tracer(m.muzzle, new W(m.muzzle.x + dx * 40, m.muzzle.y + by * 40, m.muzzle.z + dz * 40), {
                color: 16733440,
                speed: 320,
                width: 0.06,
              });
            } catch (e) {}
          }
          s.events.emit("enemy:fire", { enemy: m, pos: m.muzzle, type: "hound" });
        }
        m.stompCd -= T;
        if (K < 4.2 && m.stompCd <= 0 && D && D.alive) {
          m.stompCd = 4.4;
          try {
            D.damage(18, m.pos);
            D.addShake(0.55);
          } catch (e) {}
          s.events.emit("enemy:melee", { enemy: m, pos: m.pos });
        }
      }
      if (m.mode === "patrol") {''')

# 7) director bossAlive field + reset + objective + extraction gate
rep('        extractHint: 0,\n        evacT: 0,','        extractHint: 0,\n        evacT: 0,\n        bossAlive: !1,')
rep('        (c.evacT = 0),\n        c.used.clear(),','        (c.evacT = 0),\n        (c.bossAlive = !1),\n        c.used.clear(),')
rep('''      let mission = _.currentMission || {};
      if (c.allCut)''','''      let mission = _.currentMission || {};
      if (c.bossAlive) return "摧毁港区主控核心";
      if (c.allCut)''')
rep('        Z && c.allCut && n.alive && c.evacT <= 0\n          ? ee()','        Z && c.allCut && n.alive && c.evacT <= 0 && !c.bossAlive\n          ? ee()')

# 8) director spawn type mapping
rep('''    function N(P) {
      let V = P === "gull" ? "air" : "ground",''','''    function N(P) {
      let V = P === "gull" || P === "drone" ? "air" : "ground",''')
rep('''      return P === "gull" && fe.y < 2.5 && (fe.y = 6 + i.rng() * 3), fe;''','''      return (P === "gull" || P === "drone") && fe.y < 2.5 && (fe.y = 6 + i.rng() * 3), fe;''')

# 9) waves support drone/elite
rep('''      let V = Yi.waves[Math.min(P, Yi.waves.length - 1)],
        Y = [];
      for (let oe = 0; oe < V.gull; oe++) Y.push("gull");
      for (let oe = 0; oe < V.hound; oe++)
        Y.splice(Math.min(Y.length, 1 + oe * 2), 0, "hound");''','''      let V = Yi.waves[Math.min(P, Yi.waves.length - 1)],
        Y = [];
      for (let oe = 0; oe < V.gull; oe++) Y.push("gull");
      for (let oe = 0; oe < (V.drone || 0); oe++)
        Y.splice(Math.min(Y.length, 1 + oe * 3), 0, "drone");
      for (let oe = 0; oe < (V.elite || 0); oe++)
        Y.splice(Math.min(Y.length, 1 + oe * 2), 0, "elite");
      for (let oe = 0; oe < V.hound; oe++)
        Y.splice(Math.min(Y.length, 1 + oe * 2), 0, "hound");''')

io.open(p,'w',encoding='utf-8').write(s)
print('patched enemies part 2 + director')
