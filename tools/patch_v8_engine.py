
import io
p='src/game.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:70])
    s=s.replace(old,new,1)

# mods object after constants
rep('''    let t = build(cfg),
      W_ = cfg.reloadT || 2.1,''','''    let mods = { damage: 1, rpm: 1, reload: 1, spread: 1, recoil: 1, magAdd: 0, alert: 45 };
    let t = build(cfg),
      W_ = cfg.reloadT || 2.1,''')

# expose on ve
rep('''      ve = {
        id: cfg.id || "pac9",
        scope: !!cfg.scope,
        adsFov: cfg.adsFov || 0,''','''      ve = {
        id: cfg.id || "pac9",
        cfg: cfg,
        mods: mods,
        baseMag: Gv,
        baseReserve: B_,
        baseAdsFov: cfg.adsFov || 0,
        scope: !!cfg.scope,
        adsFov: cfg.adsFov || 0,''')

# damage in playerShot
rep('''          ut = i.combat.playerShot(Ie, pDir, { damage: H_, range: V_ });''','''          ut = i.combat.playerShot(Ie, pDir, { damage: H_ * mods.damage, range: V_ });''')

# recoil
rep('''      Me.addRecoil && Me.addRecoil(0.0068 * pn * bt * (0.85 + ae() * 0.3) * (cfg.recoil || 1), Ti),''','''      Me.addRecoil && Me.addRecoil(0.0068 * pn * bt * (0.85 + ae() * 0.3) * (cfg.recoil || 1) * mods.recoil, Ti),''')

# reload durations (two sites)
rep('''        (k.reload = { t: 0, T: Me ? G_ : W_, empty: Me, f: {} }),''','''        (k.reload = { t: 0, T: (Me ? G_ : W_) * mods.reload, empty: Me, f: {} }),''')
rep('''          (k.reload = { t: 0, T: ce.empty ? G_ : W_, empty: ce.empty, f: {} }),''','''          (k.reload = { t: 0, T: (ce.empty ? G_ : W_) * mods.reload, empty: ce.empty, f: {} }),''')

# rate of fire
rep('''            Be(), (k.cooldown += 60 / O_), Je++;''','''            Be(), (k.cooldown += 60 / (O_ * mods.rpm)), Je++;''')

# spread
rep('''        (cfg.spreadScale || 1);''','''        (cfg.spreadScale || 1) * mods.spread;''')

# fire event radius
rep('''          ads: k.adsE,
          weapon: cfg.id || "pac9",''','''          ads: k.adsE,
          weapon: cfg.id || "pac9",
          radius: mods.alert || 45,''')

# reset respects magSize
rep('''    function _e() {
      (ve.ammo = Gv),
        (ve.reserve = B_),''','''    function _e() {
      (ve.ammo = ve.magSize || Gv),
        (ve.reserve = Math.round(B_ * (1 + (mods.magAdd > 0 ? 0.25 : 0)))),''')

# enemy hearing uses event radius
rep('''        D && U.alert(D, Ui.hearRadius);''','''        D && U.alert(D, (T && T.radius) || Ui.hearRadius);''')
io.open(p,'w',encoding='utf-8').write(s)
print('weapon mods engine patch done')
