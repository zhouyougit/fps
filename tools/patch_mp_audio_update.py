
import io
p='src/mp.js'
s=io.open(p,encoding='utf-8').read()
old='''    function frame(dt) {
      sendAcc += dt;'''
new='''    function frame(dt) {
      try { if (typeof AudioExt !== "undefined") AudioExt.update(dt); } catch (e) {}
      sendAcc += dt;'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('mp audio update patched')
