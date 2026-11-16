
import io
p='src/ext.js'
s=io.open(p,encoding='utf-8').read()
old='''      speaker: function (n) { setSpeaker(n); },'''
new='''      speaker: function (n) { setSpeaker(n); },
      applyMission: function (i) { applyMission(i); },
      environment: function () {
        var r = G.render, u = r.sky && r.sky.material && r.sky.material.uniforms;
        return u ? {
          sun: u.uSunDir.value.toArray().map(function (x) { return +x.toFixed(3); }),
          zen: u.uZen.value.toArray().map(function (x) { return +x.toFixed(3); }),
          col: u.uSunCol.value.toArray().map(function (x) { return +x.toFixed(3); }),
          intensity: r.sun.intensity, exposure: r.exposure,
          rain: G.ground.rainLevel, env: G.scene.environmentIntensity
        } : null;
      },'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('env debug api added')
