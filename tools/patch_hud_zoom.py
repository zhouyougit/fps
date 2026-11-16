
import io
p='src/ext.js'
s=io.open(p,encoding='utf-8').read()
s=s.replace('".hud{transform:scale(var(--hud-scale,1));transform-origin:50% 50%;}",','".hud{zoom:var(--hud-scale,1);}",',1)
io.open(p,'w',encoding='utf-8').write(s)
print('hud zoom patched')
