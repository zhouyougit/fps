
import io
p='src/ext.js'
s=io.open(p,encoding='utf-8').read()
old='''      ".loc-card{pointer-events:none!important;}",'''
new='''      ".loc-card{pointer-events:none!important;}",
      ".x-end-choice{display:flex;gap:10px;margin:14px 0 4px;}",
      ".x-end-choice .btn{flex:1;}",
      ".x-final.x-ending{line-height:1.9;font-size:12px;}",
      ".x-final.x-ending b{color:var(--signal);}",'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('ending css added')
