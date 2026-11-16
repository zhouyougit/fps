
import io
p='src/training.js'
s=io.open(p,encoding='utf-8').read()
old='''    start: { x: 23, z: 8 },
    targets: 6,
    spawnPoints: [
      [22, 4.5, 6], [10, 6, 10], [15, 8, 21], [30, 5.5, 14],
      [20, 7.5, -2], [8, 7, 2], [27, 4.5, 19], [18, 5, -8],
      [14, 6.5, 14], [26, 8, 2]
    ]'''
new='''    start: { x: 23, z: 12, pitch: 0.12 },
    targets: 6,
    spawnPoints: [
      [22, 3.2, 6], [26, 3.6, 2], [19, 4.0, 1], [29, 4.4, 8],
      [15, 3.4, 4], [23, 5.0, -3], [27, 5.4, 14], [12, 4.2, 10],
      [31, 3.8, 15], [20, 6.0, 18]
    ]'''
assert s.count(old)==1
s=s.replace(old,new,1)
old2='''      G.player.reset({ pos: new G.THREE.Vector3(TRAINING.start.x, 0, TRAINING.start.z), yaw: 0 });
      G.player.invulnerable = true;'''
new2='''      G.player.reset({ pos: new G.THREE.Vector3(TRAINING.start.x, 0, TRAINING.start.z), yaw: 0 });
      G.player.pitch = TRAINING.start.pitch || 0;
      G.player.invulnerable = true;'''
assert s2 if False else True
assert s.count(old2)==1
s=s.replace(old2,new2,1)
io.open(p,'w',encoding='utf-8').write(s)
print('training layout updated')
