
import io
p='src/training.js'
s=io.open(p,encoding='utf-8').read()
old='''    tr.active = false;
    G.input.setGameplay && G.input.setGameplay(false);
    G.player.invulnerable = false;'''
new='''    tr.active = false;
    G.input.setGameplay && G.input.setGameplay(false);
    try { G.input.exitLock && G.input.exitLock(); } catch (e) {}
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
    G.player.invulnerable = false;'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('exit pointer lock on training finish')
