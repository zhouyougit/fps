
import io
p='server/server.cjs'
s=io.open(p,encoding='utf-8').read()
old='''      tickRate: TICK_HZ,
      boxes: world.boxes.length,'''
new='''      tickRate: TICK_HZ,
      maxPlayers: MAX_PLAYERS,
      boxes: world.boxes.length,'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('health maxPlayers')

p2='src/mp.js'
s2=io.open(p2,encoding='utf-8').read()
old2='''          active: active, selfId: selfId, serverSelf: serverSelf,'''
new2='''          active: active, selfId: selfId, serverSelf: serverSelf,
          parts: Array.from(remotes.values()).map(function (r) { return { kids: r.grp.children.length, leg: +r.legL.rotation.x.toFixed(2), shield: !!r.shield.visible, tag: !!r.tagEl }; }),'''
assert s2.count(old2)==1
s2=s2.replace(old2,new2,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('debug parts added')
