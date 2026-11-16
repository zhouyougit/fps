
import io
p='src/mp.js'
s=io.open(p,encoding='utf-8').read()
s=s.replace('''      if (m.t === "snap") rx.snap++;''','''      if (m.t === "snap") { rx.snap++; var oth = m.players && m.players.find(function (q) { return q.id !== selfId; }); if (oth) { rx.ax = oth.x; rx.az = oth.z; } }''',1)
io.open(p,'w',encoding='utf-8').write(s)
print('rx last other added')

p2='server/server.cjs'
s2=io.open(p2,encoding='utf-8').read()
old='''function broadcastSnapshots() {
  for (const room of rooms.values()) {
    if (!room.size) continue;
    room.broadcast(room.snapshot());
  }
}'''
new='''function broadcastSnapshots() {
  for (const room of rooms.values()) {
    if (!room.size) continue;
    if (tick % 60 === 0) console.log('[snap] ' + room.id + ' n=' + room.size + ' ' + [...room.players.values()].map((p) => p.id.slice(0, 4) + '@' + p.pos.x.toFixed(1) + ',' + p.pos.z.toFixed(1)).join(' '));
    room.broadcast(room.snapshot());
  }
}'''
assert s2.count(old)==1
s2=s2.replace(old,new,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('server snap log added')
