
import io
p='server/export_maps.mjs'
s=io.open(p,encoding='utf-8').read()
s=s.replace("{id:'core', mode:'map', bases:[{x:-12,z:0,yaw:-1.57},{x:12,z:0,yaw:1.57}]}","{id:'core', mode:'map', bases:[{x:0,z:9.6,yaw:0},{x:0,z:-9.6,yaw:Math.PI}]}")
io.open(p,'w',encoding='utf-8').write(s)
print('core bases patched')

p2='src/mp.js'
s2=io.open(p2,encoding='utf-8').read()
s2=s2.replace('''G.player.yaw = mapId === "core" ? (myTeam === 1 ? 1.57 : -1.57) : 0;''','''G.player.yaw = mapId === "core" ? (myTeam === 1 ? Math.PI : 0) : 0;''',1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('client core yaw patched')
