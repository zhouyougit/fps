
import io
p='src/ext.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:60])
    s=s.replace(old,new,1)

rep('''  /*__ARMORY__*/''','''  /*__ACCESS__*/

  /*__ARMORY__*/''')
rep('''    try { initArmory(); } catch (e) { console.error("[ext] armory init", e); }
    initCombatFeedback();''','''    try { initArmory(); } catch (e) { console.error("[ext] armory init", e); }
    try { initAccess(); } catch (e) { console.error("[ext] access init", e); }
    initCombatFeedback();''')
rep('''  function update(dt) {
    if (!G || !booted) return;
    if (G.game.state !== "playing") {''','''  function update(dt) {
    if (!G || !booted) return;
    try { updatePerf(dt); } catch (e) {}
    if (G.game.state !== "playing") {''')
rep('''      ".x-ar-actions{display:flex;gap:10px;margin-top:20px;}",''','''      ".x-ar-actions{display:flex;gap:10px;margin-top:20px;}",
      "/* ---- v9 access / perf ---- */",
      ".hud .h-cross i{background:var(--cross-col,var(--bone));}",
      ".x-perf{position:absolute;left:var(--gl);top:calc(96px + var(--sat));z-index:60;display:none;pointer-events:none;}",
      ".x-perf.on{display:block;}",
      ".x-perf pre{margin:0;padding:8px 11px;font:11px/1.55 var(--f-mono);color:#cfe8d0;background:rgba(4,6,8,.74);border-left:2px solid var(--signal);white-space:pre;text-shadow:none;}",''')
io.open(p,'w',encoding='utf-8').write(s)
print('ext access wiring done')

p2='src/campaign.js'
s2=io.open(p2,encoding='utf-8').read()
old2='''    S.damageScale = m.damageScale || 1;
    S.hpScale = m.hpScale || 1;'''
new2='''    S.missionDamage = m.damageScale || 1;
    S.missionHp = m.hpScale || 1;
    if (typeof recomputeScales === "function") recomputeScales();'''
assert s2.count(old2)==1
s2=s2.replace(old2,new2,1)
io.open(p2,'w',encoding='utf-8').write(s2)

p3='src/training.js'
s3=io.open(p3,encoding='utf-8').read()
old3='''    S.damageScale = 1;
    S.hpScale = 1;'''
new3='''    S.missionDamage = 1;
    S.missionHp = 1;
    if (typeof recomputeScales === "function") recomputeScales();'''
assert s3.count(old3)==1
s3=s3.replace(old3,new3,1)
io.open(p3,'w',encoding='utf-8').write(s3)

p4='src/armory.js'
s4=io.open(p4,encoding='utf-8').read()
s4=s4.replace('''      armoryTab = b.dataset.wid;
      renderArmory();''','''      armoryTab = b.dataset.wid;
      try { G.events.emit("ui:click", {}); } catch (e) {}
      renderArmory();''',1)
s4=s4.replace('''      armorySel[armoryTab][b.dataset.slot] = b.dataset.opt;
      saveArmory();
      armoryApply();
      renderArmory();''','''      armorySel[armoryTab][b.dataset.slot] = b.dataset.opt;
      saveArmory();
      armoryApply();
      try { G.events.emit("ui:click", {}); } catch (e) {}
      renderArmory();''',1)
io.open(p4,'w',encoding='utf-8').write(s4)
print('campaign/training scales + armory audio patched')
