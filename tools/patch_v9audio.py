
import io
p='src/ext.js'
s=io.open(p,encoding='utf-8').read()
old='''    try { initAccess(); } catch (e) { console.error("[ext] access init", e); }
    initCombatFeedback();'''
new='''    try { initAccess(); } catch (e) { console.error("[ext] access init", e); }
    try { initAudioPolish(); } catch (e) { console.error("[ext] audio init", e); }
    initCombatFeedback();'''
assert s.count(old)==1
s=s.replace(old,new,1)
old2='''    updateCombatFeedback();
    try { updateTraining(dt); } catch (e) { console.error("[ext] training update", e); }'''
new2='''    updateCombatFeedback();
    updateHeartbeat(dt);
    try { updateTraining(dt); } catch (e) { console.error("[ext] training update", e); }'''
assert s.count(old2)==1
s=s.replace(old2,new2,1)

# append audio functions before boot marker
old3='''  /* ------------------------------------------------------------ boot */'''
new3='''  /* ------------------------------------------------- V9 audio polish */
  function initAudioPolish() {
    S.hbT = 0;
    G.events.on("weapon:switch", function () {
      try { G.audio.play("reload_magout", { gain: 0.32, pitch: 1.45 }); } catch (e) {}
    });
    G.events.on("sx:boss-phase", function (ev) {
      try { G.audio.play("alert", { gain: 0.85, pitch: ev && ev.phase === 2 ? 0.55 : 0.72 }); } catch (e) {}
      try { G.audio.play("explosion", { gain: 0.25, pitch: 1.6 }); } catch (e) {}
    });
    G.events.on("game:state", function (e) {
      if (e && (e.state === "playing" || e.state === "intro"))
        try { G.audio.play("ui:click", { gain: 0.35 }); } catch (err) {}
    });
  }

  function updateHeartbeat(dt) {
    var P = G.player;
    if (!P || !P.alive || G.game.state !== "playing") return;
    if (P.health < P.maxHealth * 0.35) {
      S.hbT -= dt;
      if (S.hbT <= 0) {
        S.hbT = P.health < P.maxHealth * 0.2 ? 0.78 : 1.15;
        try { G.audio.play("hurt", { gain: 0.15, pitch: 0.82 }); } catch (e) {}
      }
    } else {
      S.hbT = 0;
    }
  }

  /* ------------------------------------------------------------ boot */'''
assert s.count(old3)==1
s=s.replace(old3,new3,1)
io.open(p,'w',encoding='utf-8').write(s)
print('audio polish added')
