
import io
p='src/game.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:70])
    s=s.replace(old,new,1)

rep('''      if (Oe && bt)
        if (ve.ammo > 0) {''','''      if (Oe && bt && (!cfg.semi || !k.prevFire))
        if (ve.ammo > 0) {''')
rep('''          k.bloom * bi(0.0065, 0.0022, k.adsE) +
          (we.onGround === !1 ? 0.022 : 0) -
          (we.crouching ? 0.002 * (1 - k.adsE) : 0);''','''          k.bloom * bi(0.0065, 0.0022, k.adsE) +
          (we.onGround === !1 ? 0.022 : 0) -
          (we.crouching ? 0.002 * (1 - k.adsE) : 0)) *
        (cfg.spreadScale || 1);''')
rep('''        let Z = bi(
          C.baseFov + (C.sprinting ? Mt.fovSprint : 0),
          Mt.fovAds,
          C.ads,
        );''','''        let Z = bi(
          C.baseFov + (C.sprinting ? Mt.fovSprint : 0),
          (i.weapon && i.weapon.adsFov) || Mt.fovAds,
          C.ads,
        );''')
rep('''      ve = {
        name: cfg.name,''','''      ve = {
        id: cfg.id || "pac9",
        name: cfg.name,''')
rep('''      (ve.state = k.reload
        ? "reloading"''','''      cfg.scope && (e.visible = !(k.adsE > 0.86)),
        (ve.state = k.reload
        ? "reloading"''')
io.open(p,'w',encoding='utf-8').write(s)
print('engine semi/scope patches done')
