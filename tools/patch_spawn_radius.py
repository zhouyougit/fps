
import io
p='server/server.cjs'
s=io.open(p,encoding='utf-8').read()
old='''  for (const s of (list || [])) {
    const free = spawnIsFree(w, s.x, s.z);
    if (free) out.push(free);
  }'''
new='''  for (const s of (list || [])) {
    const d = Math.hypot(s.x - base.x, s.z - base.z);
    if (d > 9) continue;
    const free = spawnIsFree(w, s.x, s.z);
    if (free) out.push(free);
  }'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('spawn radius patched')
