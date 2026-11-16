
import io
p='src/game.js'
s=io.open(p,encoding='utf-8').read()
old='''      ve = {
        id: cfg.id || "pac9",
        name: cfg.name,'''
new='''      ve = {
        id: cfg.id || "pac9",
        scope: !!cfg.scope,
        adsFov: cfg.adsFov || 0,
        name: cfg.name,'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('exposed')
