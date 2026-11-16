
import io,re,sys
p='src/game.js'
s=io.open(p,encoding='utf-8').read()
orig=s

# 1) w_ parameterization
s=s.replace('  function w_() {','  function w_(gcfg) {\n    gcfg = gcfg || mi;',1)
s=s.replace('    let b = mi.handguardR,','    let b = gcfg.handguardR,',1)
s=s.replace('    let w = mi.sightY,\n      S = mi.window,','    let w = gcfg.sightY,\n      S = gcfg.window,',1)
s=s.replace('X.setX(ne, X.getX(ne) * mi.squeeze);','X.setX(ne, X.getX(ne) * gcfg.squeeze);',1)

# 2) dm signature + cfg locals
s=s.replace('  async function dm(i) {\n    let e = new wt();\n    e.name = "viewmodel-pac9";\n    let t = w_(),',
'''  async function dm(i, cfg, build) {
    cfg = cfg || mi;
    build = build || w_;
    let e = new wt();
    e.name = "viewmodel-" + (cfg.id || "pac9");
    let t = build(cfg),
      W_ = cfg.reloadT || 2.1,
      G_ = cfg.reloadEmptyT || 2.72,
      Gv = cfg.magSize || 30,
      B_ = cfg.reserve || 150,
      O_ = cfg.rpm || 720,
      H_ = cfg.damage || 26,
      V_ = cfg.range || 300,
      qv = { p: [0, -cfg.sightY, -0.135], r: [0, 0, 0] },
      eu = { p: cfg.hipPos || [0.118, -0.122, -0.275], r: cfg.hipRot || [0.034, 0.085, -0.03] },
      tu = { p: cfg.sprintPos || [-0.035, 0.004, 0.03], r: cfg.sprintRot || [-0.04, 0.62, 0.26] },
      nu = { p: cfg.reloadPos || [-0.03, 0.1, -0.02], r: cfg.reloadRot || [0.46, 0.22, -0.8] },''',1)

# verify the replacement happened
if 'async function dm(i, cfg, build)' not in s:
    print('DM SIG REPLACE FAILED'); sys.exit(1)

# 3) replace mi.* inside the dm function body only
start = s.index('  async function dm(i, cfg, build)')
end = s.index('  async function PC(i)')
body = s[start:end]
n = body.count('mi.')
body = body.replace('mi.', 'cfg.')
print('replaced', n, 'mi refs in dm')
s = s[:start] + body + s[end:]

io.open(p,'w',encoding='utf-8').write(s)
print('patched weapon parameterization')
