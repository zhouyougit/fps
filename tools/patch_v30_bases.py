
import io
p='server/export_maps.mjs'
s=io.open(p,encoding='utf-8').read()
s=s.replace("{id:'harbor', idx:0, bases:[{x:-32,z:6,yaw:-1.57},{x:29,z:20,yaw:1.57}]}","{id:'harbor', idx:0, bases:[{x:-32,z:6,yaw:-1.57},{x:24,z:12,yaw:1.57}]}",1)
io.open(p,'w',encoding='utf-8').write(s)
print('harbor B base moved')

p2='server/fps-mp.service'
s2=io.open(p2,encoding='utf-8').read()
s2=s2.replace('Environment=MAX_PLAYERS=12','Environment=MAX_PLAYERS=12\nEnvironment=MP_DEV=1',1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('dev temp enabled')
