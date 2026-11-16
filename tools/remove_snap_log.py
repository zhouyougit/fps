
import io
p='server/server.cjs'
s=io.open(p,encoding='utf-8').read()
old='''    if (tick % 60 === 0) console.log('[snap] ' + room.id + ' n=' + room.size + ' ' + [...room.players.values()].map((p) => p.id.slice(0, 4) + '@' + p.pos.x.toFixed(1) + ',' + p.pos.z.toFixed(1)).join(' '));
'''
assert s.count(old)==1
s=s.replace(old,'',1)
io.open(p,'w',encoding='utf-8').write(s)
print('snap log removed')
