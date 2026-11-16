
import io
p='src/audio_ext.js'
s=io.open(p,encoding='utf-8').read()
old='''    function update(dt) {
      if (!started) return;
      if (combatT > 0) combatT -= dt;'''
new='''    function update(dt) {
      if (!started) return;
      var mpOn = false;
      try { mpOn = !!(window.__MP && window.__MP.state().active); } catch (e) {}
      if (mpOn && mode !== "mp") setMode("mp");
      else if (!mpOn && mode === "mp") setMode(combatT > 0 ? "combat" : "ambient");
      if (combatT > 0) combatT -= dt;'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('audio mp mode patched')
