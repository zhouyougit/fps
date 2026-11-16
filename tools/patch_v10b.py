
import io
p='src/game.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

# cover selection ranges
rep('''            ie < Gt.rangeMin ||
            ie > Gt.rangeMax ||''','''            ie < (m.rangeMin || Gt.rangeMin) ||
            ie > (m.rangeMax || Gt.rangeMax) ||''')
rep('''        let K = s.physics.nav.randomPoint(T.pos, Gt.rangeMax);''','''        let K = s.physics.nav.randomPoint(T.pos, m.rangeMax || Gt.rangeMax);''')
rep('''          ie = Gt.rangeMin + 1 + o() * (Gt.rangeMax - Gt.rangeMin - 2);''','''          ie = (m.rangeMin || Gt.rangeMin) + 1 + o() * ((m.rangeMax || Gt.rangeMax) - (m.rangeMin || Gt.rangeMin) - 2);''')

# move speed + engage window
rep('''            let se = E(T, Gt.runSpeed),
              ae = K > Gt.rangeMin - 1 && K < Gt.rangeMax + 2;''','''            let se = E(T, m.runSpeed || Gt.runSpeed),
              ae = K > (m.rangeMin || Gt.rangeMin) - 1 && K < (m.rangeMax || Gt.rangeMax) + 2;''')

# laser
rep('''              m.elite &&
                m.los &&
                D &&
                D.alive &&
                !m.boss &&''','''              (m.elite || m.laser) &&
                m.los &&
                D &&
                D.alive &&
                !m.boss &&''')

# too-close retreat
rep('''                ? K < Gt.rangeMin - 3 && m.esT > 0.8''','''                ? K < (m.rangeMin || Gt.rangeMin) - 3 && m.esT > 0.8''')

# telegraph time
rep('''                    ((m.es = "tele"),
                    (m.esT = m.elite ? 1.0 : Gt.telegraph),
                    s.events.emit("enemy:telegraph", {
                      enemy: m,
                      type: "hound",
                      time: m.elite ? 1.0 : Gt.telegraph,
                      pos: m.pos,
                    }))''','''                    ((m.es = "tele"),
                    (m.esT = m.telegraph || (m.elite ? 1.0 : Gt.telegraph)),
                    s.events.emit("enemy:telegraph", {
                      enemy: m,
                      type: "hound",
                      time: m.telegraph || (m.elite ? 1.0 : Gt.telegraph),
                      pos: m.pos,
                    }))''')

# burst count
rep('''((m.es = "burst"), (m.shots = m.boss ? 3 : m.elite ? 1 : Gt.burst), (m.esT = 0));''','''((m.es = "burst"), (m.shots = m.burstCount || (m.boss ? 3 : m.elite ? 1 : Gt.burst)), (m.esT = 0));''')

# cooldown multiplier
rep('''                (m.cool =
                  (Gt.cooldown[0] + o() * (Gt.cooldown[1] - Gt.cooldown[0])) *
                  (m.boss ? 0.68 : m.elite ? 1.25 : 1)),''','''                (m.cool =
                  (Gt.cooldown[0] + o() * (Gt.cooldown[1] - Gt.cooldown[0])) *
                  (m.coolMul || (m.boss ? 0.68 : m.elite ? 1.25 : 1))),''')

# fire damage
rep('''        Q = s.combat.enemyShot(m.muzzle, Po, {
          damage: m.boss ? 13 : m.elite ? 26 : Gt.shotDamage,
          range: 200,
        })''','''        Q = s.combat.enemyShot(m.muzzle, Po, {
          damage: m.shotDamage || (m.boss ? 13 : m.elite ? 26 : Gt.shotDamage),
          range: 240,
        })''')

# spread multiplier
rep('''        (1 + i.playerSpeed * 0.3) *
        (m.boss ? 0.8 : m.elite ? 0.45 : 1);''','''        (1 + i.playerSpeed * 0.3) *
        (m.spreadMul || (m.boss ? 0.8 : m.elite ? 0.45 : 1));''')
io.open(p,'w',encoding='utf-8').write(s)
print('hound per-instance AI patched')
