
import io
p='tools/build.cjs'
s=io.open(p,encoding='utf-8').read()
s=s.replace("const mapCore = fs.readFileSync(path.join(root,'src','map_core.js'),'utf8');","const mapCore = fs.readFileSync(path.join(root,'src','map_core.js'),'utf8');\nconst audioExt = fs.readFileSync(path.join(root,'src','audio_ext.js'),'utf8');",1)
s=s.replace("ext = ext.replace('/*__MP__*/', mp);","ext = ext.replace('/*__AUDIO__*/', audioExt);\n  if (!ext.includes('V26 · 动态音乐')) throw new Error('audio marker missing');\n  ext = ext.replace('/*__MP__*/', mp);",1)
io.open(p,'w',encoding='utf-8').write(s)
print('build audio wired')

p2='src/ext.js'
s2=io.open(p2,encoding='utf-8').read()
s2=s2.replace('''  /*__MP__*/''','''  /*__AUDIO__*/

  /*__MP__*/''',1)
s2=s2.replace('''    try { MP.init(G, MapKit); window.__MP = MP; } catch (e) { console.error("[ext] mp init", e); }''','''    try { MP.init(G, MapKit); window.__MP = MP; } catch (e) { console.error("[ext] mp init", e); }
    try { AudioExt.init(G); } catch (e) { console.error("[ext] audio ext init", e); }''',1)
s2=s2.replace('''    try { updatePerf(dt); } catch (e) {}''','''    try { updatePerf(dt); } catch (e) {}
    try { AudioExt.update(dt); } catch (e) {}''',1)
s2=s2.replace('''      speaker: function (n) { setSpeaker(n); },''','''      speaker: function (n) { setSpeaker(n); },
      audio: function () { return AudioExt.state(); },
      audioKick: function () { AudioExt.begin(); },''',1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('ext audio wired')

p3='src/mp.js'
s3=io.open(p3,encoding='utf-8').read()
s3=s3.replace('''        if (m.by === selfId) {
          try { G.hud.hitmarker(m.hs ? "kill" : "hit"); } catch (e) {}
        }''','''        if (m.by === selfId) {
          try { G.hud.hitmarker(m.hs ? "kill" : "hit"); } catch (e) {}
          try { G.audio.play("impact", { gain: 0.45, pitch: m.hs ? 1.6 : 1.3 }); } catch (e) {}
        }''',1)
s3=s3.replace('''        if (m.by === selfId) { myKills++; }
        if (m.victim === selfId) { myDeaths++; die(m.byName || "对手"); }''','''        if (m.by === selfId) { myKills++; try { G.audio.play("objective_done", { gain: 0.4, pitch: 1.25 }); } catch (e) {} }
        if (m.victim === selfId) { myDeaths++; try { G.audio.play("death", { gain: 0.6 }); } catch (e) {} die(m.byName || "对手"); }''',1)
s3=s3.replace('''        var ru = scoreUi && scoreUi._round;
        if (ru) {''','''        try { G.audio.play("alert", { gain: 0.6, pitch: 0.9 }); } catch (e) {}
        var ru = scoreUi && scoreUi._round;
        if (ru) {''',1)
io.open(p3,'w',encoding='utf-8').write(s3)
print('mp audio added')
