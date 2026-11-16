
import io
p='src/ext.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:60])
    s=s.replace(old,new,1)

# marker before tactics
rep('''  /*__TACTICS__*/''','''  /*__ARMORY__*/

  /*__TACTICS__*/''')

# init armory in boot
rep('''    try { initCampaign(); } catch (e) { console.error("[ext] campaign init", e); }
    initCombatFeedback();''','''    try { initCampaign(); } catch (e) { console.error("[ext] campaign init", e); }
    try { initArmory(); } catch (e) { console.error("[ext] armory init", e); }
    initCombatFeedback();''')

# debug api
rep('''      scanCd: function () { return S.scanCd; },''','''      scanCd: function () { return S.scanCd; },
      armory: function () { return armorySel; },
      armorySet: function (wid, slot, opt) { armorySel[wid][slot] = opt; saveArmory(); armoryApply(); return armoryStat(armoryWeapon(wid)); },
      armoryOpen: function () { openArmory(); },
      armoryStats: function (wid) { var w = armoryWeapon(wid); return w ? armoryStat(w) : null; },''')

# CSS
rep('''      "@media(max-width:620px){.x-tr-panel{padding:24px;}.x-tr-panel h2{font-size:30px;}}",''','''      "@media(max-width:620px){.x-tr-panel{padding:24px;}.x-tr-panel h2{font-size:30px;}}",
      "/* ---- v8 armory ---- */",
      ".x-armory{position:absolute;inset:0;z-index:78;display:none;color:var(--bone);pointer-events:auto;}",
      ".x-armory.on{display:block;}",
      ".x-ar-veil{position:absolute;inset:0;background:rgba(5,7,9,.9);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);}",
      ".x-ar-panel{position:relative;max-width:980px;margin:0 auto;top:50%;transform:translateY(-50%);padding:28px 32px 26px;border:1px solid rgba(232,228,218,.18);background:rgba(11,13,15,.82);max-height:94vh;overflow:auto;}",
      ".x-ar-panel h2{font:900 38px/1.05 var(--f-display);letter-spacing:.14em;margin:6px 0 16px;}",
      ".x-ar-tabs{display:flex;gap:8px;margin:0 0 18px;}",
      ".x-ar-tab{display:flex;align-items:center;gap:7px;padding:8px 12px;border:1px solid rgba(232,228,218,.18);background:rgba(11,13,15,.5);color:var(--bone);cursor:pointer;font:600 11px/1 var(--f-label);letter-spacing:.12em;}",
      ".x-ar-tab b{width:16px;height:16px;line-height:15px;text-align:center;border:1px solid rgba(232,228,218,.35);font:700 10px/1 var(--f-display);}",
      ".x-ar-tab.on{border-color:var(--signal);color:var(--signal);background:rgba(255,179,71,.1);}",
      ".x-ar-body{display:grid;grid-template-columns:1fr 220px;gap:24px;align-items:start;}",
      ".x-ar-row{margin-bottom:14px;}",
      ".x-ar-row-h{font:600 10px/1 var(--f-label);letter-spacing:.26em;color:var(--steel);text-transform:uppercase;margin-bottom:7px;}",
      ".x-ar-opts{display:flex;flex-wrap:wrap;gap:8px;}",
      ".x-ar-opt{text-align:left;min-width:150px;padding:9px 11px;border:1px solid rgba(232,228,218,.16);background:rgba(11,13,15,.5);color:var(--bone);cursor:pointer;font-family:var(--f-label);}",
      ".x-ar-opt b{display:block;font:600 12px/1.2 var(--f-label);letter-spacing:.06em;}",
      ".x-ar-opt span{display:block;margin-top:4px;font:400 10px/1.4 var(--f-mono);color:var(--steel);}",
      ".x-ar-opt.on{border-color:var(--signal);background:rgba(255,179,71,.12);}",
      ".x-ar-stats{border-left:1px solid rgba(232,228,218,.12);padding-left:18px;}",
      ".x-ar-stat{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid rgba(232,228,218,.08);padding:7px 0;}",
      ".x-ar-stat span{font:500 10px/1 var(--f-mono);letter-spacing:.12em;color:var(--steel);}",
      ".x-ar-stat b{font:700 14px/1 var(--f-display);color:var(--bone);}",
      ".x-ar-actions{display:flex;gap:10px;margin-top:20px;}",
      "@media(max-width:760px){.x-ar-body{grid-template-columns:1fr;}.x-ar-stats{border-left:0;padding-left:0;display:grid;grid-template-columns:1fr 1fr;gap:0 18px;}.x-ar-panel{padding:20px;}}",''')
io.open(p,'w',encoding='utf-8').write(s)
print('ext armory wiring done')

p2='src/campaign.js'
s2=io.open(p2,encoding='utf-8').read()
old='''        '<div class="x-camp-actions">' +
          '<button class="btn primary" data-x="go">出动</button>' +
          '<button class="btn" data-x="close">返回</button>' +
        '</div>' +'''
new='''        '<div class="x-camp-actions">' +
          '<button class="btn primary" data-x="go">出动</button>' +
          '<button class="btn" data-x="close">返回</button>' +
          '<button class="btn" data-x="arm">武器改装</button>' +
        '</div>' +'''
assert s2.count(old)==1
s2=s2.replace(old,new,1)
old2='''    overlay.querySelector('[data-x="close"]').addEventListener("click", closeMissionScreen);'''
new2='''    overlay.querySelector('[data-x="close"]').addEventListener("click", closeMissionScreen);
    overlay.querySelector('[data-x="arm"]').addEventListener("click", function () { openArmory(); });'''
assert s2.count(old2)==1
s2=s2.replace(old2,new2,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('campaign armory button added')
