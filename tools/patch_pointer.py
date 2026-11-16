
import io
p='src/ext.js'
s=io.open(p,encoding='utf-8').read()
old='      ".x-camp{position:absolute;inset:0;z-index:70;display:none;color:var(--bone);}",'
new='      ".x-camp{position:absolute;inset:0;z-index:70;display:none;color:var(--bone);pointer-events:auto;}",'
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('pointer-events fix applied')
