
import io
p='src/campaign.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

# M1 env
rep('''      rain: 0.6, exposure: 1, saturation: 1, evac: 45,''','''      rain: 0.6, exposure: 1, saturation: 1, evac: 45,
      env: { sun: [0.92, 0.23, 0.33], zen: [0.055, 0.085, 0.13], hor: [0.95, 0.55, 0.28], away: [0.16, 0.22, 0.3], col: [1, 0.72, 0.42], light: 0xffddad, intensity: 9, exposure: 1, envIntensity: 2, rain: 0.6 },''')

# M2 env
rep('''      rain: 1, exposure: 0.92, saturation: 0.86, evac: 45,''','''      rain: 1, exposure: 0.92, saturation: 0.86, evac: 45,
      env: { sun: [0.4, 0.12, 0.9], zen: [0.02, 0.03, 0.045], hor: [0.16, 0.2, 0.26], away: [0.06, 0.075, 0.1], col: [0.35, 0.42, 0.55], light: 0xaab7c9, intensity: 3.2, exposure: 0.82, envIntensity: 1.2, rain: 1 },''')

# M3 env
rep('''      rain: 0.35, exposure: 1.08, saturation: 1.04, evac: 0, boss: true,''','''      rain: 0.35, exposure: 1.08, saturation: 1.04, evac: 0, boss: true,
      env: { sun: [0.75, 0.1, -0.65], zen: [0.05, 0.07, 0.15], hor: [1.0, 0.5, 0.36], away: [0.13, 0.15, 0.24], col: [1, 0.55, 0.36], light: 0xffc9a8, intensity: 6.5, exposure: 1.06, envIntensity: 2.1, rain: 0.2 },''')

# applyEnvironment function before applyMission
rep('''  function applyMission(idx) {''','''  function applyEnvironment(env) {
    if (!env || !G || !G.render) return;
    var r = G.render;
    try {
      var u = r.sky && r.sky.material && r.sky.material.uniforms;
      if (u) {
        if (u.uSunDir && env.sun) u.uSunDir.value.set(env.sun[0], env.sun[1], env.sun[2]).normalize();
        if (u.uZen && env.zen) u.uZen.value.set(env.zen[0], env.zen[1], env.zen[2]);
        if (u.uHor && env.hor) u.uHor.value.set(env.hor[0], env.hor[1], env.hor[2]);
        if (u.uHorAway && env.away) u.uHorAway.value.set(env.away[0], env.away[1], env.away[2]);
        if (u.uSunCol && env.col) u.uSunCol.value.set(env.col[0], env.col[1], env.col[2]);
      }
      if (r.sun) {
        if (env.sun) {
          var v = new G.THREE.Vector3(env.sun[0], env.sun[1], env.sun[2]).normalize();
          r.sun.position.copy(v).multiplyScalar(200);
        }
        if (env.light != null) r.sun.color.set(env.light);
        if (env.intensity != null) r.sun.intensity = env.intensity;
      }
      if (env.exposure != null) r.exposure = env.exposure;
      if (env.envIntensity != null && G.scene) G.scene.environmentIntensity = env.envIntensity;
      if (env.rain != null && G.ground) G.ground.setRain(env.rain);
      if (env.saturation != null && r.post) r.post.saturation = env.saturation;
    } catch (e) { console.error("[ext] environment", e); }
  }

  function applyMission(idx) {''')

# replace old env application in applyMission
rep('''    try { G.ground.setRain(m.rain); } catch (e) {}
    try { G.render.exposure = m.exposure; } catch (e) {}
    try { if (G.render.post) G.render.post.saturation = m.saturation; } catch (e) {}''','''    applyEnvironment(m.env);''')
io.open(p,'w',encoding='utf-8').write(s)
print('campaign env patched')

p2='src/training.js'
s2=io.open(p2,encoding='utf-8').read()
old='''    try { G.ground.setRain(0.35); } catch (e) {}
    try { G.render.exposure = 1.02; } catch (e) {}
    try { if (G.render.post) G.render.post.saturation = 1; } catch (e) {}'''
new='''    try {
      applyEnvironment({ sun: [0.92, 0.23, 0.33], zen: [0.055, 0.085, 0.13], hor: [0.95, 0.55, 0.28], away: [0.16, 0.22, 0.3], col: [1, 0.72, 0.42], light: 0xffddad, intensity: 8, exposure: 1.02, envIntensity: 2, rain: 0.35 });
    } catch (e) {}'''
assert s2.count(old)==1
s2=s2.replace(old,new,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('training env patched')
