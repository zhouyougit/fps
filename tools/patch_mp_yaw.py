
import io
p='src/mp.js'
s=io.open(p,encoding='utf-8').read()
old='''        G.input.setGameplay && G.input.setGameplay(true);
        try { G.input.requestLock(); } catch (e) {}'''
new='''        G.input.setGameplay && G.input.setGameplay(true);
        try { if (welcome.map && welcome.map.spawn && typeof welcome.map.spawn.yaw === "number") G.player.yaw = welcome.map.spawn.yaw; } catch (e) {}
        try { G.input.requestLock(); } catch (e) {}'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('client spawn yaw patched')

p2='tools/test_mp_maps.mjs'
s2=io.open(p2,encoding='utf-8').read()
s2=s2.replace('a.boxes===161 && b.boxes===161','a.boxes===169 && b.boxes===169')
s2=s2.replace('a.boxes===67','a.boxes===90')
io.open(p2,'w',encoding='utf-8').write(s2)
print('map test counts updated')
