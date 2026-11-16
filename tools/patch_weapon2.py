
import io
p='src/game.js'
s=io.open(p,encoding='utf-8').read()

# 1) left hand anchor follows cfg.handguard
old='      G = T(H, [-0.015, -0.062, -0.236]),'
new='      G = T(H, [(cfg.handguard ? cfg.handguard[0] : 0) - 0.015, (cfg.handguard ? cfg.handguard[1] : 0) - 0.062, cfg.handguard ? cfg.handguard[2] : -0.236]),'
assert s.count(old)==1
s=s.replace(old,new,1)

# 2) pellets + per-weapon recoil in Be()
old2='''      let ut = null;
      try {
        ut = i.combat.playerShot(Ie, ze, { damage: H_, range: V_ });
      } catch {}
      ut && ut.point ? Ne.copy(ut.point) : Ne.copy(Ie).addScaledVector(ze, V_),
        Re(We);'''
new2='''      let ut = null,
        pellets = cfg.pellets || 1,
        firstPoint = null;
      for (let pi = 0; pi < pellets; pi++) {
        let pDir = ze;
        if (pi > 0) {
          let so = ae() * Math.PI * 2,
            sp = Math.tan(be * (cfg.pelletSpread || 1)) * Math.sqrt(ae());
          pDir = new gi(Math.cos(so) * sp, Math.sin(so) * sp, -1)
            .normalize()
            .applyQuaternion(we.quaternion);
        }
        try {
          ut = i.combat.playerShot(Ie, pDir, { damage: H_, range: V_ });
        } catch {}
        if (!firstPoint && ut && ut.point) firstPoint = ut.point;
      }
      firstPoint ? Ne.copy(firstPoint) : Ne.copy(Ie).addScaledVector(ze, V_),
        Re(We);'''
assert s.count(old2)==1, s.count(old2)
s=s.replace(old2,new2,1)

# 3) recoil scale
old3='      Me.addRecoil && Me.addRecoil(0.0068 * pn * bt * (0.85 + ae() * 0.3), Ti),\n        Me.addShake && Me.addShake(0.12 * bt),'
new3='      Me.addRecoil && Me.addRecoil(0.0068 * pn * bt * (0.85 + ae() * 0.3) * (cfg.recoil || 1), Ti),\n        Me.addShake && Me.addShake(0.12 * bt * (cfg.recoil || 1)),'
assert s.count(old3)==1, s.count(old3)
s=s.replace(old3,new3,1)

io.open(p,'w',encoding='utf-8').write(s)
print('patched fire + hand anchor')
