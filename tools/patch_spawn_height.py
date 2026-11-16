
import io
p='server/server.cjs'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)
rep('''  const g = w.groundHeight(x, z, 50);''','''  const g = w.groundHeight(x, z, 3);''')
rep('''    const y = w.groundHeight(base.x, base.z, 50);''','''    const y = w.groundHeight(base.x, base.z, 3);''')
rep('''    const gy = room.world.groundHeight(fallback.x, fallback.z, 50);''','''    const gy = room.world.groundHeight(fallback.x, fallback.z, 3);''')
io.open(p,'w',encoding='utf-8').write(s)
print('spawn height max3 patched')
