
import io
p='server/server.cjs'
s=io.open(p,encoding='utf-8').read()
old='''  if (room.size === 1) { room.roundStart = Date.now(); room.roundOver = false; }'''
new='''  if (room.size === 2) { room.roundStart = Date.now(); room.roundOver = false; }'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('round start on second join')

p2='tools/test_mp_combat.mjs'
s2=io.open(p2,encoding='utf-8').read()
s2=s2.replace("ok('无运行时错误', pages[0].errs.length===0 && pages[1].errs.length===0 && !b.err, {a:pages[0].errs.slice(0,2),b:pages[1].errs.slice(0,2)});","ok('无运行时错误', pages[0].errs.length===0 && pages[1].errs.length===0 && (!b.err || b.err.length===0), {a:pages[0].errs.slice(0,2),b:pages[1].errs.slice(0,2)});",1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('test condition fixed')
