
import io
p='src/ext.js'
s=io.open(p,encoding='utf-8').read()

def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:60])
    s=s.replace(old,new,1)

# 1) state fields
rep('''    checkpoint: null,
    lastRelayCut: 0
  };''','''    checkpoint: null,
    lastRelayCut: 0,
    damageScale: 1,
    hpScale: 1
  };''')

# 2) armor multiplier
rep('''      if (!P.alive || P.invulnerable || !(amount > 0)) return baseDamage(amount, from);''','''      if (!P.alive || P.invulnerable || !(amount > 0)) return baseDamage(amount, from);
      amount *= S.damageScale || 1;''')

# 3) campaign marker + boot integration
rep('''  /* ------------------------------------------------------------ boot */
  function boot() {
    if (booted) return;
    G = window.__G;''','''  /*__CAMPAIGN__*/

  /* ------------------------------------------------------------ boot */
  function boot() {
    if (booted) return;
    G = window.__G;
    if (G.level && G.level.stub) {
      booted = true;
      console.log("[ext] showcase mode — extension skipped");
      return;
    }''')

rep('''    HUD = buildHUD();
    HUD.setArmor(G.player.armor || 0);
    spawnPickups();
    booted = true;''','''    HUD = buildHUD();
    HUD.setArmor(G.player.armor || 0);
    spawnPickups();
    booted = true;

    try { initCampaign(); } catch (e) { console.error("[ext] campaign init", e); }

    // 敌人 HP 缩放（战役难度）
    var baseSpawn = G.enemies.spawn;
    G.enemies.spawn = function (type, pos, opts) {
      var en = baseSpawn.call(G.enemies, type, pos, opts);
      if (en && (S.hpScale || 1) !== 1 && en.alive) en.hp *= S.hpScale;
      return en;
    };''')

# 4) CSS additions
rep('''      ".is-touch .x-loadout{bottom:auto;top:calc(18px + var(--sat));right:auto;left:50%;transform:translateX(-50%);}"
    ].join("\\n");''','''      ".is-touch .x-loadout{bottom:auto;top:calc(18px + var(--sat));right:auto;left:50%;transform:translateX(-50%);}",
      "/* ---- v3 campaign ---- */",
      ".x-camp{position:absolute;inset:0;z-index:70;display:none;color:var(--bone);}",
      ".x-camp.on{display:block;}",
      ".x-camp-veil{position:absolute;inset:0;background:rgba(6,8,10,.9);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);}",
      ".x-camp-panel{position:relative;max-width:1080px;margin:0 auto;padding:7vh 5vw 6vh;max-height:100%;overflow:auto;}",
      ".x-camp-h{font:900 clamp(28px,4vw,48px)/1.05 var(--f-display);letter-spacing:.1em;margin:8px 0 6px;}",
      ".x-camp-sub{font:500 12px/1.7 var(--f-mono);letter-spacing:.12em;color:var(--steel);margin-bottom:26px;}",
      ".x-camp-list{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}",
      ".x-mcard{position:relative;text-align:left;padding:20px 20px 18px;background:rgba(11,13,15,.55);border:1px solid rgba(232,228,218,.16);color:var(--bone);cursor:pointer;transition:border-color .2s,background .2s;min-height:196px;font-family:var(--f-label);}",
      ".x-mcard:hover{border-color:rgba(232,228,218,.42);}",
      ".x-mcard.sel{border-color:var(--signal);background:rgba(255,179,71,.1);}",
      ".x-mcard.locked{opacity:.4;cursor:not-allowed;}",
      ".x-mcard .code{font:700 11px/1 var(--f-mono);letter-spacing:.3em;color:var(--signal);}",
      ".x-mcard h3{font:900 24px/1.1 var(--f-display);letter-spacing:.06em;margin:10px 0 4px;}",
      ".x-mcard .sub{font:500 11px/1.4 var(--f-mono);letter-spacing:.1em;color:var(--steel);}",
      ".x-mcard p{font:400 12px/1.7 var(--f-label);color:var(--bone-dim);margin:12px 0 0;}",
      ".x-mcard .meta{margin-top:14px;font:500 10px/1.5 var(--f-mono);color:rgba(232,228,218,.5);letter-spacing:.06em;}",
      ".x-mcard .lock{position:absolute;right:14px;top:14px;font:600 10px/1 var(--f-label);letter-spacing:.2em;color:var(--bone-faint);}",
      ".x-camp-actions{display:flex;gap:10px;margin-top:26px;}",
      ".x-camp-note{margin-top:16px;font:400 11px/1.6 var(--f-mono);color:var(--bone-faint);letter-spacing:.06em;}",
      "@media(max-width:820px){.x-camp-list{grid-template-columns:1fr;}.x-mcard{min-height:0;}}"
    ].join("\\n");''')

io.open(p,'w',encoding='utf-8').write(s)
print('patched ext for campaign')
