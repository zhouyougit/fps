
import io
p='src/campaign.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

# M2 start inside warehouse + env saturation
rep('''      env: { sun: [0.4, 0.12, 0.9], zen: [0.02, 0.03, 0.045], hor: [0.16, 0.2, 0.26], away: [0.06, 0.075, 0.1], col: [0.35, 0.42, 0.55], light: 0xaab7c9, intensity: 3.2, exposure: 0.82, envIntensity: 1.2, rain: 1 },''','''      env: { sun: [0.4, 0.12, 0.9], zen: [0.02, 0.03, 0.045], hor: [0.16, 0.2, 0.26], away: [0.06, 0.075, 0.1], col: [0.35, 0.42, 0.55], light: 0xaab7c9, intensity: 3.2, exposure: 0.82, envIntensity: 1.2, rain: 1, saturation: 0.82 },
      start: { x: -10, z: -20, yaw: -1.57 },''')

# playerStart override
rep('''    applyEnvironment(m.env);''','''    applyEnvironment(m.env);
    try {
      if (!G.level.__origStart) G.level.__origStart = { pos: G.level.playerStart.pos.clone(), yaw: G.level.playerStart.yaw };
      var st = m.start || G.level.__origStart;
      var sy = G.physics.groundHeight(st.x, st.z, 10);
      G.level.playerStart = { pos: new G.THREE.Vector3(st.x, sy, st.z), yaw: st.yaw };
    } catch (e) {}''')
io.open(p,'w',encoding='utf-8').write(s)
print('m2 start + saturation patched')

p2='src/ext.js'
s2=io.open(p2,encoding='utf-8').read()
old='''      if (env.saturation != null && r.post) r.post.saturation = env.saturation;'''
new='''      if (env.saturation != null && r.post) r.post.saturation = env.saturation;
      else if (r.post) r.post.saturation = 1;'''
assert s2.count(old)==1
s2=s2.replace(old,new,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('env saturation fallback patched')
